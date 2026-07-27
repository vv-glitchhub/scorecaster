import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { buildCollectorInsights } from "../../../../../lib/collector-insights.mjs";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
}

export async function GET(request, context) {
  const params = await context.params;
  const eventId = clean(params?.eventId, 180);
  if (!eventId) return Response.json({ ok: false, error: "Event id is required" }, { status: 400, headers: HEADERS });
  const url = new URL(request.url);
  const allowed = new Set(["hours", "limit", "bucketMinutes"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return Response.json({ ok: false, error: "Unsupported query parameter" }, { status: 400, headers: HEADERS });
  const hours = integer(url.searchParams.get("hours"), 720, 1, 8760);
  const limit = integer(url.searchParams.get("limit"), 2000, 1, 5000);
  const bucketMinutes = integer(url.searchParams.get("bucketMinutes"), 60, 5, 1440);
  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ ok: false, error: "Collector database is not configured", records: [] }, { status: 503, headers: HEADERS });

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("collector_records")
      .select("source_id,event_id,entity_id,sport,league,metric,value,unit,observed_at,collected_at,payload,confidence,source_trust,attribution,attribution_required")
      .eq("publishable", true)
      .eq("event_id", eventId)
      .gte("collected_at", since)
      .order("observed_at", { ascending: true })
      .limit(limit);
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
      sourceTrust: Number(row.source_trust || 0),
      attribution: row.attribution_required ? row.attribution : null
    }));
    const insights = buildCollectorInsights(records, { bucketMinutes, limit: 1 });
    return Response.json({
      ok: true,
      version: "scorecaster-collector-event-v1",
      generatedAt: new Date().toISOString(),
      eventId,
      count: records.length,
      event: insights.events[0] || null,
      sourceQuality: insights.sourceQuality,
      timeSeries: insights.timeSeries,
      incidents: insights.incidents,
      records,
      safety: insights.safety
    }, { headers: HEADERS });
  } catch (error) {
    return Response.json({
      ok: false,
      error: migrationMissing(error) ? "Collector migration is not active" : process.env.NODE_ENV === "production" ? "Collector event data could not be loaded" : String(error),
      records: []
    }, { status: migrationMissing(error) ? 503 : 500, headers: HEADERS });
  }
}
