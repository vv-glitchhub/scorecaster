import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

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

function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "Collector maintenance secret is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);
  const url = new URL(request.url);
  const allowed = new Set(["retentionDays", "apply"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return response({ ok: false, error: "Unsupported query parameter" }, 400);
  const retentionDays = integer(url.searchParams.get("retentionDays"), 730, 30, 3650);
  const apply = url.searchParams.get("apply") === "true";
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [oldRecords, oldRuns, missingEventIds, missingMetrics] = await Promise.all([
      admin.from("collector_records").select("id", { count: "exact", head: true }).lt("collected_at", cutoff),
      admin.from("collector_runs").select("id", { count: "exact", head: true }).lt("started_at", cutoff),
      admin.from("collector_records").select("id", { count: "exact", head: true }).is("event_id", null),
      admin.from("collector_records").select("id", { count: "exact", head: true }).is("metric", null)
    ]);
    for (const result of [oldRecords, oldRuns, missingEventIds, missingMetrics]) if (result.error) throw result.error;

    let deletedRecords = 0;
    let deletedRuns = 0;
    if (apply) {
      const [recordDelete, runDelete] = await Promise.all([
        admin.from("collector_records").delete().lt("collected_at", cutoff),
        admin.from("collector_runs").delete().lt("started_at", cutoff)
      ]);
      if (recordDelete.error) throw recordDelete.error;
      if (runDelete.error) throw runDelete.error;
      deletedRecords = Number(oldRecords.count || 0);
      deletedRuns = Number(oldRuns.count || 0);
    }

    return response({
      ok: true,
      version: "scorecaster-collector-maintenance-v1",
      completedAt: new Date().toISOString(),
      mode: apply ? "apply" : "dry-run",
      retentionDays,
      cutoff,
      eligibleRecords: Number(oldRecords.count || 0),
      eligibleRuns: Number(oldRuns.count || 0),
      deletedRecords,
      deletedRuns,
      integrity: {
        missingEventIds: Number(missingEventIds.count || 0),
        missingMetrics: Number(missingMetrics.count || 0),
        valid: Number(missingEventIds.count || 0) === 0 && Number(missingMetrics.count || 0) === 0
      },
      safety: { paperOnly: true, probabilityChanged: false, publishabilityChanged: false }
    });
  } catch (error) {
    return response({
      ok: false,
      error: migrationMissing(error) ? "Collector migration is not active" : process.env.NODE_ENV === "production" ? "Collector maintenance failed" : String(error),
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_collector_v1.sql" : undefined
    }, migrationMissing(error) ? 503 : 500);
  }
}
