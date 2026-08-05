import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "../../../../lib/api-security";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { normalizeContextBatch } from "../../../../lib/context-ingestion.mjs";

export const dynamic = "force-dynamic";

const clean = (value, max = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);

function operatorAllowed(user, env = process.env) {
  const emails = String(env.SCORECASTER_OPERATOR_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const ids = String(env.SCORECASTER_OPERATOR_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return Boolean(
    (user?.email && emails.includes(String(user.email).toLowerCase())) ||
    (user?.id && ids.includes(String(user.id)))
  );
}

async function requireOperator(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return { error: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  if (!operatorAllowed(auth.user)) {
    return { error: jsonResponse({ ok: false, error: "Operator access is not configured for this account" }, 403, requestId) };
  }
  return auth;
}

function missingMigration(error) {
  return error?.code === "42P01" || /context_evidence_v1|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await requireOperator(request, requestId);
  if (auth.error) return auth.error;
  const limited = await enforceRateLimit(auth, requestId, { bucket: "context_operator_read", limit: 30, windowSeconds: 60 });
  if (limited) return limited;

  const admin = getSupabaseAdmin();
  if (!admin) return jsonResponse({ ok: false, error: "Supabase admin client is not configured" }, 503, requestId);
  const url = new URL(request.url);
  const eventId = clean(url.searchParams.get("eventId"), 180);
  if (!eventId) return jsonResponse({ ok: false, error: "eventId is required" }, 400, requestId);

  const { data, error } = await admin
    .from("context_evidence_v1")
    .select("id,event_id,sport,league,kickoff_at,team_role,team,category,subject,status,confirmation,impact,confidence,source_trust,source_id,observed_at,effective_at,expires_at,supersedes_id,public_note,source_reference,created_at")
    .eq("event_id", eventId)
    .order("observed_at", { ascending: false })
    .limit(500);

  if (error) {
    return jsonResponse({
      ok: false,
      error: missingMigration(error) ? "Context Engine production patch is not active" : "Context evidence could not be loaded",
      requiredPatch: missingMigration(error) ? "scripts/apply-context-engine-v1.sql" : undefined
    }, missingMigration(error) ? 503 : 500, requestId);
  }

  return jsonResponse({ ok: true, eventId, records: data || [], paperOnly: true }, 200, requestId);
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }
  const auth = await requireOperator(request, requestId);
  if (auth.error) return auth.error;
  const limited = await enforceRateLimit(auth, requestId, { bucket: "context_operator_write", limit: 10, windowSeconds: 60 });
  if (limited) return limited;

  const body = await readJsonBody(request, 256 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const events = Array.isArray(body.data?.events) ? body.data.events.slice(0, 250) : [];
  const suppliedRecords = Array.isArray(body.data?.records) ? body.data.records.slice(0, 2000) : [];
  if (!events.length || !suppliedRecords.length) {
    return jsonResponse({ ok: false, error: "events and records arrays are required" }, 400, requestId);
  }

  const records = suppliedRecords.map((record) => ({
    ...record,
    sourceId: "manual_licensed_import",
    sourceTrust: record?.sourceTrust ?? record?.source_trust ?? 0.8
  }));
  const normalized = normalizeContextBatch(records, {
    events,
    sourceId: "manual_licensed_import",
    collectedAt: new Date().toISOString()
  });
  if (!normalized.accepted.length) {
    return jsonResponse({
      ok: false,
      error: "No context records passed validation",
      rejected: normalized.rejected,
      paperOnly: true
    }, 422, requestId);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonResponse({ ok: false, error: "Supabase admin client is not configured" }, 503, requestId);

  try {
    const eventIds = [...new Set(normalized.accepted.map((item) => item.row.event_id))];
    const { data: existing, error: existingError } = await admin
      .from("context_evidence_v1")
      .select("id,source_id,source_reference")
      .in("event_id", eventIds)
      .not("source_reference", "is", null)
      .limit(10_000);
    if (existingError) throw existingError;

    const existingMap = new Map((existing || []).map((row) => [`${row.source_id}:${row.source_reference}`, row]));
    const insertRows = [];
    let duplicates = 0;
    for (const item of normalized.accepted) {
      const key = `${item.row.source_id}:${item.sourceReference}`;
      if (existingMap.has(key)) {
        duplicates += 1;
        continue;
      }
      const superseded = item.supersedesSourceReference
        ? existingMap.get(`${item.row.source_id}:${item.supersedesSourceReference}`)
        : null;
      insertRows.push({ ...item.row, ...(superseded?.id ? { supersedes_id: superseded.id } : {}) });
    }

    let inserted = [];
    if (insertRows.length) {
      const { data, error } = await admin
        .from("context_evidence_v1")
        .upsert(insertRows, { onConflict: "id", ignoreDuplicates: true })
        .select("id,event_id,source_id,source_reference");
      if (error) throw error;
      inserted = data || [];
    }

    return jsonResponse({
      ok: true,
      version: "scorecaster-context-operator-import-v1",
      received: normalized.received,
      accepted: normalized.accepted.length,
      rejected: normalized.rejected,
      duplicates,
      stored: inserted.length,
      sourceId: "manual_licensed_import",
      operatorUserId: auth.user.id,
      rawPayloadStored: false,
      probabilityChanged: false,
      paperOnly: true
    }, 200, requestId);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: missingMigration(error) ? "Context Engine production patch is not active" : "Context evidence could not be stored",
      requiredPatch: missingMigration(error) ? "scripts/apply-context-engine-v1.sql" : undefined
    }, missingMigration(error) ? 503 : 500, requestId);
  }
}
