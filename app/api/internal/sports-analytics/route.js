import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { fetchExternalSportsAnalytics, sportsAnalyticsProviderConfiguration } from "../../../../lib/sports-analytics-provider";
import { buildNhlXgGoalieShadowV1 } from "../../../../lib/nhl-xg-goalie-shadow-v1.mjs";
import { buildSoccerXgPoissonShadowV1 } from "../../../../lib/soccer-xg-poisson-shadow-v1.mjs";
import { buildBasketballEfficiencyShadowV1 } from "../../../../lib/basketball-efficiency-shadow-v1.mjs";
import {
  buildAutomaticObservationsFromPick,
  buildSportsAnalyticsSnapshot,
  mergeAnalyticsObservations,
  toSportsAnalyticsObservationRows
} from "../../../../lib/sports-analytics-ingestion.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("sports_analytics_") && (text.includes("does not exist") || text.includes("schema cache"));
}

function eventId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.id, 180);
}

function matchFromPick(pick = {}) {
  return {
    eventId: eventId(pick),
    homeTeam: clean(pick.homeTeam, 140),
    awayTeam: clean(pick.awayTeam, 140),
    sportKey: clean(pick.sportKey || pick.league, 120),
    sport: clean(pick.sportTitle || pick.sportKey, 120),
    league: clean(pick.leagueTitle || pick.league, 140),
    commenceTime: pick.commenceTime || pick.commence_time || null,
    venue: clean(pick.venue || pick.stadium, 180)
  };
}

function uniqueEvents(picks = []) {
  const rows = new Map();
  for (const pick of picks) {
    const id = eventId(pick);
    if (id && !rows.has(id)) rows.set(id, pick);
  }
  return [...rows.values()].slice(0, 20);
}

function eventLevelAdvancedModels(pick = {}, observations = [], capturedAt = new Date().toISOString()) {
  const now = Date.parse(capturedAt);
  const eventPick = { ...pick, selection: pick.homeTeam, label: pick.homeTeam };
  const existingNhl = pick.nhlXgGoalieShadowV1;
  const existingSoccer = pick.soccerXgPoissonShadowV1;
  const existingBasketball = pick.basketballEfficiencyShadowV1;
  const nhl = existingNhl?.status === "ready"
    ? existingNhl
    : buildNhlXgGoalieShadowV1(eventPick, observations, { now });
  const soccer = existingSoccer?.status === "ready"
    ? existingSoccer
    : buildSoccerXgPoissonShadowV1(eventPick, observations, { now });
  const basketball = existingBasketball?.status === "ready"
    ? existingBasketball
    : buildBasketballEfficiencyShadowV1(eventPick, observations, { now });
  return { nhl, soccer, basketball };
}

function compactShadowModels(pick = {}, observations = [], capturedAt) {
  const rows = [];
  const { nhl, soccer, basketball } = eventLevelAdvancedModels(pick, observations, capturedAt);
  if (nhl?.status === "ready" && finite(nhl.homeMoneylineProbability) !== null && finite(nhl.awayMoneylineProbability) !== null) {
    rows.push({
      modelId: clean(nhl.modelId, 160),
      modelVersion: clean(nhl.version, 160),
      family: "expected-performance",
      sport: "ice_hockey",
      generatedAt: nhl.generatedAt || null,
      predictionHorizon: nhl.predictionHorizon || null,
      inputSnapshotHash: clean(nhl.inputSnapshotHash, 128),
      homeTeam: clean(pick.homeTeam, 140),
      awayTeam: clean(pick.awayTeam, 140),
      probabilities: {
        home: finite(nhl.homeMoneylineProbability),
        away: finite(nhl.awayMoneylineProbability)
      },
      projectedGoals: nhl.projectedGoals || null,
      providers: Array.isArray(nhl.provenance?.providers) ? nhl.provenance.providers.slice(0, 10) : [],
      metrics: Array.isArray(nhl.provenance?.metrics) ? nhl.provenance.metrics.slice(0, 30) : [],
      calibrated: false,
      eventLevelHoldoutCapture: true,
      productionProbabilityChanged: false,
      paperOnly: true
    });
  }

  if (soccer?.status === "ready" && soccer.probabilities) {
    const home = finite(soccer.probabilities.home);
    const draw = finite(soccer.probabilities.draw);
    const away = finite(soccer.probabilities.away);
    if (home !== null && draw !== null && away !== null) {
      rows.push({
        modelId: clean(soccer.modelId, 160),
        modelVersion: clean(soccer.version, 160),
        family: "expected-performance",
        sport: "soccer",
        generatedAt: soccer.generatedAt || null,
        predictionHorizon: soccer.predictionHorizon || null,
        inputSnapshotHash: clean(soccer.inputSnapshotHash, 128),
        homeTeam: clean(pick.homeTeam, 140),
        awayTeam: clean(pick.awayTeam, 140),
        probabilities: { home, draw, away },
        projectedGoals: soccer.projectedGoals || null,
        providers: Array.isArray(soccer.provenance?.providers) ? soccer.provenance.providers.slice(0, 10) : [],
        metrics: Array.isArray(soccer.provenance?.metrics) ? soccer.provenance.metrics.slice(0, 30) : [],
        calibrated: false,
        eventLevelHoldoutCapture: true,
        productionProbabilityChanged: false,
        paperOnly: true
      });
    }
  }

  if (basketball?.status === "ready" && basketball.probabilities) {
    const home = finite(basketball.probabilities.home);
    const away = finite(basketball.probabilities.away);
    if (home !== null && away !== null) {
      rows.push({
        modelId: clean(basketball.modelId, 160),
        modelVersion: clean(basketball.modelVersion || basketball.version, 160),
        family: "performance-statistics",
        sport: "basketball",
        generatedAt: basketball.generatedAt || null,
        predictionHorizon: basketball.predictionHorizon || null,
        inputSnapshotHash: clean(basketball.inputSnapshotHash, 128),
        homeTeam: clean(pick.homeTeam, 140),
        awayTeam: clean(pick.awayTeam, 140),
        probabilities: { home, away },
        projectedPoints: basketball.projected || null,
        providers: Array.isArray(basketball.provenance?.providers) ? basketball.provenance.providers.slice(0, 10) : [],
        metrics: Array.isArray(basketball.provenance?.metrics) ? basketball.provenance.metrics.slice(0, 30) : [],
        calibrated: false,
        eventLevelHoldoutCapture: true,
        productionProbabilityChanged: false,
        paperOnly: true
      });
    }
  }

  return rows;
}

async function storeEvent(admin, pick, capturedAt) {
  const automatic = buildAutomaticObservationsFromPick(pick, { capturedAt });
  const external = await fetchExternalSportsAnalytics(matchFromPick(pick), { capturedAt });
  const observations = mergeAnalyticsObservations(automatic, external.observations);
  const providerStatus = {
    automatic: {
      source: "scorecaster-unified-data",
      mode: automatic.length ? "live" : "unavailable",
      ok: automatic.length > 0,
      observationCount: automatic.length
    },
    external: {
      source: external.source,
      mode: external.mode,
      ok: external.ok,
      observationCount: external.observations.length,
      reason: external.reason || null
    }
  };
  const snapshot = buildSportsAnalyticsSnapshot({
    pick,
    observations,
    golfShots: external.golfShots,
    providerStatus,
    capturedAt
  });
  if (!snapshot.event_id) return null;

  const shadowModels = compactShadowModels(pick, observations, capturedAt);
  snapshot.raw_summary = {
    ...(snapshot.raw_summary || {}),
    shadowLedgerVersion: "advanced-shadow-prediction-ledger-v1",
    shadowModels,
    shadowModelCount: shadowModels.length,
    shadowPredictionsCapturedBeforeStart: true,
    shadowPredictionsImmutableByCaptureBucket: true,
    selectionIndependentEventDistributionCaptured: true
  };

  const { data: storedSnapshot, error: snapshotError } = await admin
    .from("sports_analytics_snapshots")
    .upsert(snapshot, { onConflict: "event_id,capture_bucket" })
    .select("id,event_id,canonical_sport,captured_at,observation_count,provider_count,coverage_score")
    .single();
  if (snapshotError) throw snapshotError;

  const observationRows = toSportsAnalyticsObservationRows(storedSnapshot.id, snapshot, observations);
  if (observationRows.length) {
    const { error: observationError } = await admin
      .from("sports_analytics_observations")
      .upsert(observationRows, { onConflict: "fingerprint" });
    if (observationError) throw observationError;
  }

  return {
    snapshot: storedSnapshot,
    automaticObservations: automatic.length,
    externalObservations: external.observations.length,
    externalMode: external.mode,
    golfShots: external.golfShots.length,
    shadowModelsCaptured: shadowModels.length
  };
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return response({ ok: false, error: "Sports analytics cron secret is not configured" }, 503);
  if (!authorized(request)) return response({ ok: false, error: "Unauthorized" }, 401);
  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "Supabase admin client is not configured" }, 503);

  try {
    const capturedAt = new Date().toISOString();
    const origin = new URL(request.url).origin;
    const topPicksResponse = await fetch(`${origin}/api/top-picks`, {
      cache: "no-store",
      signal: AbortSignal.timeout(75_000)
    });
    const topPicks = await topPicksResponse.json();
    if (!topPicksResponse.ok || topPicks?.ok === false) {
      return response({ ok: false, error: topPicks?.error || topPicks?.reason || "Top Picks unavailable" }, 503);
    }

    const picks = uniqueEvents(Array.isArray(topPicks.data) ? topPicks.data : []);
    const settled = await Promise.allSettled(picks.map((pick) => storeEvent(admin, pick, capturedAt)));
    const stored = settled.filter((item) => item.status === "fulfilled" && item.value).map((item) => item.value);
    const failures = settled.filter((item) => item.status === "rejected");

    return response({
      ok: failures.length === 0,
      version: "sports-analytics-worker-v4",
      shadowLedgerVersion: "advanced-shadow-prediction-ledger-v1",
      capturedAt,
      eventsRequested: picks.length,
      eventsStored: stored.length,
      observationsStored: stored.reduce((sum, item) => sum + item.automaticObservations + item.externalObservations, 0),
      automaticObservations: stored.reduce((sum, item) => sum + item.automaticObservations, 0),
      externalObservations: stored.reduce((sum, item) => sum + item.externalObservations, 0),
      shadowModelsCaptured: stored.reduce((sum, item) => sum + item.shadowModelsCaptured, 0),
      golfShots: stored.reduce((sum, item) => sum + item.golfShots, 0),
      externalProvider: sportsAnalyticsProviderConfiguration(),
      failures: failures.length,
      failureReasons: process.env.NODE_ENV === "production" ? [] : failures.slice(0, 5).map((item) => String(item.reason)),
      probabilityChanged: false,
      paperOnly: true
    }, failures.length && stored.length === 0 ? 500 : 200);
  } catch (error) {
    return response({
      ok: false,
      error: migrationMissing(error)
        ? "Sports analytics migration is not active"
        : process.env.NODE_ENV === "production"
          ? "Sports analytics capture failed"
          : String(error),
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_sports_analytics.sql" : undefined
    }, migrationMissing(error) ? 503 : 500);
  }
}
