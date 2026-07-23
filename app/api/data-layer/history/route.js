import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { buildUnifiedDataHistory } from "../../../../lib/unified-sports-data-v2.mjs";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function clean(value, limit = 200) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function integer(value, fallback, min, max) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("unified_data_") && (text.includes("does not exist") || text.includes("schema cache"));
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["eventId", "selection", "hours", "limit"]);
  const unknown = [...url.searchParams.keys()].filter((key) => !allowed.has(key));
  if (unknown.length) return response({ ok: false, error: "Unsupported query parameter" }, 400);

  const eventId = clean(url.searchParams.get("eventId"), 180);
  const selection = clean(url.searchParams.get("selection"), 160);
  const hours = integer(url.searchParams.get("hours"), 72, 1, 24 * 30);
  const limit = integer(url.searchParams.get("limit"), 500, 10, 2000);
  const admin = getSupabaseAdmin();
  if (!admin) {
    return response({
      ok: true,
      version: "unified-sports-data-history-v2",
      historyAvailable: false,
      reason: "Supabase admin client is not configured",
      migrationRequired: "supabase/scorecaster_unified_data.sql",
      data: buildUnifiedDataHistory()
    });
  }

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    let snapshotQuery = admin
      .from("unified_data_snapshots")
      .select("id,capture_bucket,captured_at,event_id,sport_key,league,commence_time,home_team,away_team,selection,decision,odds,market_probability,provider_count,provider_disagreement,coverage_score,used_factor_count,total_context_impact,safety_action,missing_families,factor_statuses,provider_summary")
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
      .limit(limit);
    if (eventId) snapshotQuery = snapshotQuery.eq("event_id", eventId);
    if (selection) snapshotQuery = snapshotQuery.eq("selection", selection);

    const [snapshotResult, providerResult, closingResult, incidentResult] = await Promise.all([
      snapshotQuery,
      admin
        .from("unified_data_provider_observations")
        .select("event_id,selection,provider_key,family,mode,ok,trust,confidence,observed_at,age_hours,divergence_from_primary,captured_at")
        .gte("captured_at", since)
        .order("captured_at", { ascending: true })
        .limit(limit * 4),
      admin
        .from("unified_data_closing_records")
        .select("event_id,selection,sport_key,league,commence_time,opening_odds,opening_captured_at,closing_odds,closing_captured_at,price_clv,source,finalized_at")
        .order("commence_time", { ascending: false })
        .limit(100),
      admin
        .from("unified_data_incidents")
        .select("fingerprint,incident_type,severity,title,message,event_id,provider_key,details,active,first_seen_at,last_seen_at,resolved_at")
        .order("last_seen_at", { ascending: false })
        .limit(100)
    ]);

    const firstError = [snapshotResult.error, providerResult.error, closingResult.error, incidentResult.error].find(Boolean);
    if (firstError) throw firstError;

    const snapshots = eventId
      ? snapshotResult.data || []
      : snapshotResult.data || [];
    const observations = (providerResult.data || []).filter((row) => !eventId || row.event_id === eventId).filter((row) => !selection || row.selection === selection);
    const closingRecords = (closingResult.data || []).filter((row) => !eventId || row.event_id === eventId).filter((row) => !selection || row.selection === selection);
    const incidents = (incidentResult.data || []).filter((row) => !eventId || !row.event_id || row.event_id === eventId);
    const data = buildUnifiedDataHistory({ snapshots, observations, closingRecords, incidents });

    return response({
      ok: true,
      historyAvailable: true,
      filters: { eventId: eventId || null, selection: selection || null, hours, limit },
      safety: {
        probabilitySource: "no-vig market consensus",
        closingOddsPostStartOnly: true,
        contextCanUpgrade: false,
        paperOnly: true
      },
      data
    });
  } catch (error) {
    if (migrationMissing(error)) {
      return response({
        ok: true,
        historyAvailable: false,
        reason: "Unified data migration is not active",
        migrationRequired: "supabase/scorecaster_unified_data.sql",
        data: buildUnifiedDataHistory()
      });
    }
    return response({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Unified data history could not be loaded" : String(error)
    }, 500);
  }
}