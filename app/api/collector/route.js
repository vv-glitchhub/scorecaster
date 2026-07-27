import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildCollectorInsights } from "../../../lib/collector-insights.mjs";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

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

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["sport", "eventId", "metric", "sourceId", "hours", "limit", "bucketMinutes", "eventLimit"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return response({ ok: false, error: "Unsupported query parameter" }, 400);
  }

  const sport = clean(url.searchParams.get("sport"), 80).toLowerCase().replace(/[\s-]+/g, "_");
  const eventId = clean(url.searchParams.get("eventId"), 180);
  const metric = clean(url.searchParams.get("metric"), 120).toLowerCase();
  const sourceId = clean(url.searchParams.get("sourceId"), 80).toLowerCase();
  const hours = integer(url.searchParams.get("hours"), 168, 1, 2160);
  const limit = integer(url.searchParams.get("limit"), 500, 1, 2000);
  const bucketMinutes = integer(url.searchParams.get("bucketMinutes"), 60, 5, 1440);
  const eventLimit = integer(url.searchParams.get("eventLimit"), 50, 1, 200);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Collector database is not configured", records: [], insights: null }, 503);

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    let query = admin
      .from("collector_records")
      .select("source_id,event_id,entity_id,sport,league,metric,value,unit,observed_at,collected_at,payload,confidence,source_trust,attribution,attribution_required")
      .eq("publishable", true)
      .gte("collected_at", since)
      .order("observed_at", { ascending: false })
      .limit(limit);
    if (sport) query = query.eq("sport", sport);
    if (eventId) query = query.eq("event_id", eventId);
    if (metric) query = query.eq("metric", metric);
    if (sourceId) query = query.eq("source_id", sourceId);
    const { data, error } = await query;
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
    const insights = buildCollectorInsights(records, { bucketMinutes, limit: eventLimit });

    return response({
      ok: true,
      version: "scorecaster-collector-api-v2",
      generatedAt: new Date().toISOString(),
      filters: { sport: sport || null, eventId: eventId || null, metric: metric || null, sourceId: sourceId || null, hours, limit, bucketMinutes, eventLimit },
      count: records.length,
      records,
      insights,
      safety: { publishableOnly: true, researchDataExcluded: true, paperOnly: true, probabilityChanged: false }
    });
  } catch (error) {
    return response({
      ok: false,
      error: migrationMissing(error) ? "Collector migration is not active" : process.env.NODE_ENV === "production" ? "Collector data could not be loaded" : String(error),
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_collector_v1.sql" : undefined,
      records: [],
      insights: null
    }, migrationMissing(error) ? 503 : 500);
  }
}
