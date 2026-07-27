import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function csv(value) {
  const text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("collector_") && (text.includes("does not exist") || text.includes("schema cache"));
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["sport", "eventId", "metric", "sourceId", "hours", "limit"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return Response.json({ ok: false, error: "Unsupported query parameter" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const sport = clean(url.searchParams.get("sport"), 80).toLowerCase().replace(/[\s-]+/g, "_");
  const eventId = clean(url.searchParams.get("eventId"), 180);
  const metric = clean(url.searchParams.get("metric"), 120).toLowerCase();
  const sourceId = clean(url.searchParams.get("sourceId"), 80).toLowerCase();
  const hours = integer(url.searchParams.get("hours"), 720, 1, 8760);
  const limit = integer(url.searchParams.get("limit"), 5000, 1, 10_000);
  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ ok: false, error: "Collector database is not configured" }, { status: 503 });

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    let query = admin
      .from("collector_records")
      .select("source_id,event_id,entity_id,sport,league,metric,value,unit,observed_at,collected_at,confidence,source_trust,attribution,attribution_required,payload")
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

    const headers = ["source_id", "event_id", "entity_id", "sport", "league", "metric", "value", "unit", "observed_at", "collected_at", "confidence", "source_trust", "attribution", "payload"];
    const rows = (data || []).map((row) => [
      row.source_id,
      row.event_id,
      row.entity_id,
      row.sport,
      row.league,
      row.metric,
      row.value,
      row.unit,
      row.observed_at,
      row.collected_at,
      row.confidence,
      row.source_trust,
      row.attribution_required ? row.attribution : null,
      row.payload
    ].map(csv).join(","));
    const body = `\uFEFF${headers.join(",")}\n${rows.join("\n")}\n`;
    const date = new Date().toISOString().slice(0, 10);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scorecaster-collector-${date}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: migrationMissing(error) ? "Collector migration is not active" : process.env.NODE_ENV === "production" ? "Collector export failed" : String(error)
    }, { status: migrationMissing(error) ? 503 : 500, headers: { "Cache-Control": "no-store" } });
  }
}
