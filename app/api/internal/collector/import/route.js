import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { normalizeCollectorBatch } from "../../../../../lib/collector-normalize.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function clean(value, limit = 300) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
}

export async function POST(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "Collector import secret is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2_000_000) return response({ ok: false, error: "Import payload too large" }, 413);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  try {
    const body = await request.json();
    const licenseReference = clean(body?.licenseReference, 300);
    if (body?.rightsConfirmed !== true || licenseReference.length < 6) {
      return response({ ok: false, error: "Explicit rights confirmation and licenseReference are required" }, 400);
    }
    const inputs = Array.isArray(body?.records) ? body.records.slice(0, 5000) : [];
    if (!inputs.length) return response({ ok: false, error: "No records supplied" }, 400);
    const collectedAt = new Date().toISOString();
    const enriched = inputs.map((record) => ({
      ...record,
      payload: {
        ...(record?.payload && typeof record.payload === "object" ? record.payload : {}),
        importLicenseReference: licenseReference,
        importedBy: "protected-collector-import"
      }
    }));
    const normalized = normalizeCollectorBatch(enriched, {
      sourceId: "manual_licensed_import",
      collectedAt
    });

    const { data: run, error: runError } = await admin.from("collector_runs").insert({
      started_at: collectedAt,
      completed_at: collectedAt,
      status: normalized.records.length ? "success" : "failed",
      trigger_type: "import",
      source_count: 1,
      received_count: normalized.received,
      accepted_count: normalized.accepted,
      rejected_count: normalized.rejectedCount,
      publishable_count: normalized.publishable,
      research_only_count: normalized.researchOnly,
      source_status: [{ sourceId: "manual_licensed_import", mode: "licensed-import", ok: normalized.records.length > 0, records: normalized.records.length }],
      errors: normalized.rejected.slice(0, 20),
      paper_only: true
    }).select("id").single();
    if (runError) throw runError;

    if (normalized.records.length) {
      const rows = normalized.records.map((record) => ({ ...record, run_id: run.id }));
      const { error } = await admin.from("collector_records").upsert(rows, { onConflict: "fingerprint", ignoreDuplicates: true });
      if (error) throw error;
    }

    return response({
      ok: normalized.records.length > 0,
      version: "scorecaster-collector-import-v1",
      runId: run.id,
      received: normalized.received,
      accepted: normalized.accepted,
      rejected: normalized.rejectedCount,
      publishable: normalized.publishable,
      licenseReference,
      probabilityChanged: false,
      paperOnly: true
    }, normalized.records.length ? 200 : 400);
  } catch (error) {
    return response({
      ok: false,
      error: migrationMissing(error) ? "Collector migration is not active" : process.env.NODE_ENV === "production" ? "Collector import failed" : String(error),
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_collector_v1.sql" : undefined
    }, migrationMissing(error) ? 503 : 500);
  }
}
