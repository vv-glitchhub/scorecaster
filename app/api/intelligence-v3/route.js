import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildIntelligenceBundle } from "../../../lib/intelligence-v3.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (payload, status = 200) => Response.json(payload, { status, headers: HEADERS });
const clean = (value, limit = 180) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);

function integer(value, fallback, min, max) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["eventId", "hours", "iterations"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return response({ ok: false, error: "Unsupported query parameter" }, 400);
  const eventId = clean(url.searchParams.get("eventId"), 180);
  const hours = integer(url.searchParams.get("hours"), 720, 1, 2160);
  const iterations = integer(url.searchParams.get("iterations"), 20000, 1000, 100000);
  if (!eventId) return response({ ok: false, error: "eventId is required" }, 400);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Intelligence database is not configured" }, 503);

  try {
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    const { data, error } = await admin
      .from("collector_records")
      .select("source_id,event_id,entity_id,sport,league,metric,value,unit,observed_at,collected_at,payload,confidence,source_trust")
      .eq("publishable", true)
      .eq("event_id", eventId)
      .gte("collected_at", since)
      .order("observed_at", { ascending: true })
      .limit(5000);
    if (error) throw error;
    const records = (data || []).map((row) => ({
      sourceId: row.source_id,
      eventId: row.event_id,
      entityId: row.entity_id,
      sport: row.sport,
      league: row.league,
      metric: row.metric,
      value: row.value === null || row.value === undefined ? null : Number(row.value),
      unit: row.unit,
      observedAt: row.observed_at,
      collectedAt: row.collected_at,
      payload: row.payload && typeof row.payload === "object" ? row.payload : {},
      confidence: Number(row.confidence || 0),
      sourceTrust: Number(row.source_trust || 0)
    }));
    return response({ ok: true, version: "scorecaster-intelligence-v3", records: records.length, bundle: buildIntelligenceBundle(records, { eventId, iterations }), limitations: records.length ? [] : ["No publishable Collector observations found for this event"] });
  } catch (error) {
    return response({ ok: false, error: migrationMissing(error) ? "Collector migration is not active" : process.env.NODE_ENV === "production" ? "Intelligence analysis failed" : String(error), migrationRequired: migrationMissing(error) ? "supabase/scorecaster_collector_v1.sql" : undefined }, migrationMissing(error) ? 503 : 500);
  }
}
