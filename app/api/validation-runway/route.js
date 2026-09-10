import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { OWNED_FOOTBALL_LEAGUES } from "../../../lib/active-market-universe.js";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

const response = (payload, status = 200) => Response.json(payload, { status, headers: HEADERS });

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function latestPerEvent(rows = []) {
  const latest = new Map();
  for (const row of [...rows].sort((a, b) => (timestamp(b?.as_of) ?? 0) - (timestamp(a?.as_of) ?? 0))) {
    const eventId = String(row?.event_id || "").trim();
    if (eventId && !latest.has(eventId)) latest.set(eventId, row);
  }
  return [...latest.values()];
}

export async function GET(request) {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].length) {
    return response({ ok: false, error: "Unsupported query parameter" }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Validation runway unavailable" }, 503);

  const nowIso = new Date().toISOString();
  try {
    const [futureResult, pastResult] = await Promise.all([
      admin
        .from("scorecaster_pit_feature_snapshots_v1")
        .select("event_id,sport_key,commence_time,as_of,eligible_for_model,leakage_guard_passed")
        .in("sport_key", [...OWNED_FOOTBALL_LEAGUES])
        .gt("commence_time", nowIso)
        .order("as_of", { ascending: false })
        .limit(2500),
      admin
        .from("scorecaster_pit_feature_snapshots_v1")
        .select("event_id,sport_key,commence_time,as_of,eligible_for_model,leakage_guard_passed")
        .in("sport_key", [...OWNED_FOOTBALL_LEAGUES])
        .lte("commence_time", nowIso)
        .order("as_of", { ascending: false })
        .limit(2500)
    ]);
    if (futureResult.error) throw futureResult.error;
    if (pastResult.error) throw pastResult.error;

    const future = latestPerEvent(futureResult.data || []);
    const upcomingIds = future.map((row) => row.event_id).filter(Boolean);
    let mappings = [];
    if (upcomingIds.length) {
      const mappingResult = await admin
        .from("scorecaster_event_identity_map_v1")
        .select("source_event_id,verified,match_confidence")
        .eq("source_id", "the_odds_api")
        .in("source_event_id", upcomingIds)
        .limit(2500);
      if (mappingResult.error) throw mappingResult.error;
      mappings = mappingResult.data || [];
    }

    const verifiedByEvent = new Map(
      mappings
        .filter((row) => row.verified === true && Number(row.match_confidence) >= 0.94)
        .map((row) => [String(row.source_event_id), Number(row.match_confidence)])
    );
    const earliestUpcomingKickoff = future
      .map((row) => row.commence_time)
      .filter(Boolean)
      .sort((a, b) => (timestamp(a) ?? Infinity) - (timestamp(b) ?? Infinity))[0] || null;

    const settledPregameEvents = latestPerEvent(pastResult.data || []).filter((row) => {
      const asOf = timestamp(row.as_of);
      const kickoff = timestamp(row.commence_time);
      return asOf !== null
        && kickoff !== null
        && asOf < kickoff
        && row.eligible_for_model === true
        && row.leakage_guard_passed === true;
    });

    const mapped = future.filter((row) => verifiedByEvent.has(String(row.event_id))).length;
    const upcoming = future.length;

    return response({
      ok: true,
      version: "scorecaster-validation-runway-v1",
      asOf: nowIso,
      ownedFootballLeagues: [...OWNED_FOOTBALL_LEAGUES],
      upcomingEvents: upcoming,
      verifiedIdentityMappings: mapped,
      unmappedEvents: Math.max(0, upcoming - mapped),
      identityCoverage: upcoming > 0 ? mapped / upcoming : null,
      earliestUpcomingKickoff,
      chronologySafeStartedEvents: settledPregameEvents.length,
      nextEvidenceStage: settledPregameEvents.length > 0
        ? "awaiting-verified-outcomes-or-learning-materialization"
        : upcoming > 0
          ? "awaiting-first-owned-football-settlement"
          : "awaiting-owned-football-pregame-events",
      contracts: {
        aggregationOnly: true,
        teamNamesExposed: false,
        chronologyRequired: true,
        verifiedIdentityMinimumConfidence: 0.94,
        syntheticBackfillAllowed: false,
        automaticModelPromotionAllowed: false,
        realMoneyActionAvailable: false,
        paperOnly: true
      }
    });
  } catch (error) {
    console.error("validation runway failed", error);
    return response({ ok: false, error: "Validation runway unavailable" }, 503);
  }
}