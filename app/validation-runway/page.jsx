import { getSupabaseAdmin } from "../../lib/supabase-admin";
import { OWNED_FOOTBALL_LEAGUES } from "../../lib/active-market-universe.js";
import ValidationRunwayClient from "./ValidationRunwayClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Validation Runway",
  description: "Chronology-safe pregame evidence readiness and canonical event identity coverage for Scorecaster owned football models."
};

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

async function loadValidationRunway() {
  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const fallback = {
    ok: false,
    version: "scorecaster-validation-runway-v1",
    asOf: nowIso,
    upcomingEvents: null,
    verifiedIdentityMappings: null,
    unmappedEvents: null,
    identityCoverage: null,
    earliestUpcomingKickoff: null,
    chronologySafeStartedEvents: null,
    contracts: {
      aggregationOnly: true,
      teamNamesExposed: false,
      chronologyRequired: true,
      syntheticBackfillAllowed: false,
      automaticModelPromotionAllowed: false,
      realMoneyActionAvailable: false,
      paperOnly: true
    }
  };
  if (!admin) return fallback;

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
    if (futureResult.error || pastResult.error) return fallback;

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
      if (mappingResult.error) return fallback;
      mappings = mappingResult.data || [];
    }

    const verifiedIds = new Set(
      mappings
        .filter((row) => row.verified === true && Number(row.match_confidence) >= 0.94)
        .map((row) => String(row.source_event_id))
    );
    const mapped = future.filter((row) => verifiedIds.has(String(row.event_id))).length;
    const earliestUpcomingKickoff = future
      .map((row) => row.commence_time)
      .filter(Boolean)
      .sort((a, b) => (timestamp(a) ?? Infinity) - (timestamp(b) ?? Infinity))[0] || null;
    const chronologySafeStartedEvents = latestPerEvent(pastResult.data || []).filter((row) => {
      const asOf = timestamp(row.as_of);
      const kickoff = timestamp(row.commence_time);
      return asOf !== null
        && kickoff !== null
        && asOf < kickoff
        && row.eligible_for_model === true
        && row.leakage_guard_passed === true;
    }).length;

    return {
      ...fallback,
      ok: true,
      upcomingEvents: future.length,
      verifiedIdentityMappings: mapped,
      unmappedEvents: Math.max(0, future.length - mapped),
      identityCoverage: future.length ? mapped / future.length : null,
      earliestUpcomingKickoff,
      chronologySafeStartedEvents
    };
  } catch {
    return fallback;
  }
}

export default async function ValidationRunwayPage() {
  const data = await loadValidationRunway();
  return <ValidationRunwayClient data={data} />;
}
