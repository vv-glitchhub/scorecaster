import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildProductionControlCenter } from "../../../lib/production-control-center.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (payload, status = 200) => Response.json(payload, { status, headers: HEADERS });
const integer = (value, fallback, min, max) => { const parsed = Number.parseInt(String(value || ""), 10); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; };
const clean = (value, limit = 80) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, limit);
const migrationMissing = (error) => { const text = String(error?.message || error || "").toLowerCase(); return text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache")); };

function settledSamples(records = []) {
  const events = new Map();
  for (const row of records) {
    const id = row.event_id;
    if (!id) continue;
    const current = events.get(id) || {};
    if (row.metric === "model_probability" || (!current.probability && row.metric === "market_probability")) current.probability = Number(row.value);
    if (["result", "event_result", "won"].includes(row.metric)) current.result = Number(row.value);
    events.set(id, current);
  }
  return [...events.values()].filter((row) => Number.isFinite(row.probability) && [0, 1].includes(row.result));
}

export async function GET(request) {
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Production database is not configured" }, 503);
  const url = new URL(request.url);
  const allowed = new Set(["hours", "sport", "limit"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return response({ ok: false, error: "Unsupported query parameter" }, 400);
  const hours = integer(url.searchParams.get("hours"), 720, 24, 8760);
  const limit = integer(url.searchParams.get("limit"), 5000, 100, 10000);
  const sport = clean(url.searchParams.get("sport"), 80).toLowerCase();
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  try {
    let query = admin.from("collector_records")
      .select("source_id,event_id,entity_id,sport,league,metric,value,unit,observed_at,collected_at,confidence,source_trust,payload")
      .eq("publishable", true)
      .gte("collected_at", since)
      .order("observed_at", { ascending: false })
      .limit(limit);
    if (sport) query = query.eq("sport", sport);
    const [{ data, error }, latestRun] = await Promise.all([
      query,
      admin.from("collector_runs").select("status,started_at,completed_at,accepted_count,rejected_count,publishable_count").order("started_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    if (error) throw error;
    if (latestRun.error) throw latestRun.error;
    const records = (data || []).map((row) => ({
      sourceId: row.source_id, eventId: row.event_id, entityId: row.entity_id, sport: row.sport, league: row.league,
      metric: row.metric, value: row.value === null ? null : Number(row.value), unit: row.unit,
      observedAt: row.observed_at, collectedAt: row.collected_at, confidence: Number(row.confidence || 0),
      sourceTrust: Number(row.source_trust || 0), payload: row.payload || {}
    }));
    const last = latestRun.data;
    const health = last ? { status: last.status === "failed" ? "degraded" : Date.now() - new Date(last.started_at).getTime() > 90 * 60000 ? "stale" : "healthy", lastRun: last } : { status: "not-activated", lastRun: null };
    const controlCenter = buildProductionControlCenter({ records, settledSamples: settledSamples(data || []), collectorHealth: health });
    return response({ ok: true, filters: { hours, sport: sport || null, limit }, ...controlCenter });
  } catch (error) {
    return response({ ok: false, error: migrationMissing(error) ? "Collector migration is not active" : process.env.NODE_ENV === "production" ? "Production control center could not be loaded" : String(error), migrationRequired: migrationMissing(error) ? "supabase/scorecaster_collector_v1.sql" : undefined }, migrationMissing(error) ? 503 : 500);
  }
}
