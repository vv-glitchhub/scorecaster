import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildIntelligenceV4 } from "../../../lib/intelligence-v4.mjs";

export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (payload, status = 200) => Response.json(payload, { status, headers: HEADERS });
const integer = (value, fallback, min, max) => { const parsed = Number.parseInt(String(value || ""), 10); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; };

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["sport", "hours", "iterations", "bankroll"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return response({ ok: false, error: "Unsupported query parameter" }, 400);
  const sport = String(url.searchParams.get("sport") || "").trim().toLowerCase().replace(/[\s-]+/g, "_").slice(0, 80);
  const hours = integer(url.searchParams.get("hours"), 720, 24, 2160);
  const iterations = integer(url.searchParams.get("iterations"), 5000, 500, 50000);
  const bankroll = integer(url.searchParams.get("bankroll"), 1000, 100, 1000000);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Collector database is not configured" }, 503);
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    let query = admin.from("collector_records")
      .select("source_id,event_id,entity_id,sport,metric,value,observed_at,collected_at,payload,confidence,source_trust")
      .eq("publishable", true).gte("collected_at", since).order("observed_at", { ascending: false }).limit(5000);
    if (sport) query = query.eq("sport", sport);
    const { data, error } = await query;
    if (error) throw error;
    const grouped = new Map();
    for (const row of data || []) {
      const eventId = String(row.event_id || "");
      if (!eventId) continue;
      if (!grouped.has(eventId)) grouped.set(eventId, { eventId, records: [] });
      grouped.get(eventId).records.push({ sourceId: row.source_id, eventId, entityId: row.entity_id, sport: row.sport, metric: row.metric, value: row.value === null ? null : Number(row.value), observedAt: row.observed_at, collectedAt: row.collected_at, payload: row.payload || {}, confidence: Number(row.confidence || 0), sourceTrust: Number(row.source_trust || 0) });
    }
    const bundle = buildIntelligenceV4([...grouped.values()], { iterations, bankroll });
    return response({ ok: true, filters: { sport: sport || null, hours, iterations, bankroll }, ...bundle });
  } catch (error) {
    const text = String(error?.message || error).toLowerCase();
    const missing = text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
    return response({ ok: false, error: missing ? "Collector migration is not active" : process.env.NODE_ENV === "production" ? "Intelligence V4 could not be generated" : String(error) }, missing ? 503 : 500);
  }
}
