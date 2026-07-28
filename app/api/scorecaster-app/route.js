import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildProductionControlCenter } from "../../../lib/production-control-center.mjs";
import { buildIntelligenceBundle } from "../../../lib/intelligence-v3.mjs";
import { buildIntelligenceV4 } from "../../../lib/intelligence-v4.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const clampInt = (value, fallback, min, max) => { const n = Number.parseInt(String(value || ""), 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; };
const clean = (value, limit = 80) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, limit).toLowerCase();

function groupEvents(records = []) {
  const map = new Map();
  for (const row of records) {
    if (!row.eventId) continue;
    const current = map.get(row.eventId) || { eventId: row.eventId, sport: row.sport, league: row.league, records: [] };
    current.records.push(row);
    if (!current.sport && row.sport) current.sport = row.sport;
    if (!current.league && row.league) current.league = row.league;
    map.set(row.eventId, current);
  }
  return [...map.values()].map((event) => {
    const latest = [...event.records].sort((a, b) => new Date(b.observedAt || 0) - new Date(a.observedAt || 0))[0];
    const sources = new Set(event.records.map((row) => row.sourceId).filter(Boolean));
    const metrics = [...new Set(event.records.map((row) => row.metric).filter(Boolean))].sort();
    return { ...event, latestAt: latest?.observedAt || null, sources: [...sources].sort(), metrics };
  }).sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0));
}

function settledSamples(records = []) {
  const map = new Map();
  for (const row of records) {
    if (!row.eventId) continue;
    const item = map.get(row.eventId) || {};
    if (row.metric === "model_probability" || (!Number.isFinite(item.probability) && row.metric === "market_probability")) item.probability = Number(row.value);
    if (["result", "event_result", "won"].includes(row.metric)) item.result = Number(row.value);
    map.set(row.eventId, item);
  }
  return [...map.values()].filter((item) => Number.isFinite(item.probability) && [0, 1].includes(item.result));
}

export async function GET(request) {
  const admin = getSupabaseAdmin();
  if (!admin) return json({ ok: false, error: "Production database is not configured" }, 503);
  const url = new URL(request.url);
  const allowed = new Set(["hours", "sport", "limit", "eventId"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return json({ ok: false, error: "Unsupported query parameter" }, 400);
  const hours = clampInt(url.searchParams.get("hours"), 2160, 24, 8760);
  const limit = clampInt(url.searchParams.get("limit"), 10000, 100, 10000);
  const sport = clean(url.searchParams.get("sport"));
  const selectedEventId = clean(url.searchParams.get("eventId"), 160);
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  try {
    let query = admin.from("collector_records")
      .select("source_id,event_id,entity_id,sport,league,metric,value,unit,observed_at,collected_at,confidence,source_trust,payload")
      .eq("publishable", true).gte("collected_at", since).order("observed_at", { ascending: false }).limit(limit);
    if (sport) query = query.eq("sport", sport);
    const [{ data, error }, latestRun] = await Promise.all([
      query,
      admin.from("collector_runs").select("status,started_at,completed_at,accepted_count,rejected_count,publishable_count").order("started_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    if (error) throw error;
    if (latestRun.error) throw latestRun.error;
    const records = (data || []).map((row) => ({
      sourceId: row.source_id, eventId: row.event_id, entityId: row.entity_id, sport: row.sport, league: row.league,
      metric: row.metric, value: row.value === null ? null : Number(row.value), unit: row.unit, observedAt: row.observed_at,
      collectedAt: row.collected_at, confidence: Number(row.confidence || 0), sourceTrust: Number(row.source_trust || 0), payload: row.payload || {}
    }));
    const events = groupEvents(records);
    const last = latestRun.data;
    const collectorHealth = last ? { status: last.status === "failed" ? "degraded" : Date.now() - new Date(last.started_at).getTime() > 90 * 60000 ? "stale" : "healthy", lastRun: last } : { status: "not-activated", lastRun: null };
    const controlCenter = buildProductionControlCenter({ records, settledSamples: settledSamples(records), collectorHealth });
    const intelligenceV4 = buildIntelligenceV4(events, { iterations: 10000, bankroll: 1000 });
    const selected = events.find((event) => event.eventId === selectedEventId) || events[0] || null;
    const intelligenceV3 = selected ? buildIntelligenceBundle(selected.records, { eventId: selected.eventId, iterations: 10000, bankroll: 1000 }) : null;
    const catalogue = {
      sports: [...new Set(records.map((row) => row.sport).filter(Boolean))].sort(),
      leagues: [...new Set(records.map((row) => row.league).filter(Boolean))].sort(),
      sources: [...new Set(records.map((row) => row.sourceId).filter(Boolean))].sort(),
      metrics: [...new Set(records.map((row) => row.metric).filter(Boolean))].sort()
    };
    return json({ ok: true, generatedAt: new Date().toISOString(), filters: { hours, sport: sport || null, limit }, collectorHealth, controlCenter, intelligenceV4, intelligenceV3, selectedEventId: selected?.eventId || null, catalogue, events: events.map(({ records: eventRecords, ...event }) => ({ ...event, recordCount: eventRecords.length })), records });
  } catch (error) {
    const text = String(error?.message || error || "").toLowerCase();
    const migrationMissing = text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
    return json({ ok: false, error: migrationMissing ? "Collector migration is not active" : process.env.NODE_ENV === "production" ? "Scorecaster app data could not be loaded" : String(error), migrationRequired: migrationMissing ? "supabase/scorecaster_collector_v1.sql" : undefined }, migrationMissing ? 503 : 500);
  }
}
