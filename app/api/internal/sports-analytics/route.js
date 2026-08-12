import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { fetchExternalSportsAnalytics, sportsAnalyticsProviderConfiguration } from "../../../../lib/sports-analytics-provider";
import { buildNhlXgGoalieShadowV1 } from "../../../../lib/nhl-xg-goalie-shadow-v1.mjs";
import { buildSoccerXgPoissonShadowV1 } from "../../../../lib/soccer-xg-poisson-shadow-v1.mjs";
import { buildBasketballEfficiencyShadowV1 } from "../../../../lib/basketball-efficiency-shadow-v1.mjs";
import { buildMlbPitchingOffenseShadowV1 } from "../../../../lib/mlb-pitching-offense-shadow-v1.mjs";
import {
  buildAutomaticObservationsFromPick,
  buildSportsAnalyticsSnapshot,
  mergeAnalyticsObservations,
  toSportsAnalyticsObservationRows
} from "../../../../lib/sports-analytics-ingestion.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (payload, status = 200) => Response.json(payload, { status, headers: HEADERS });
const authorized = (request) => Boolean(process.env.CRON_SECRET) && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
const clean = (value, limit = 180) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const eventId = (pick = {}) => clean(pick.gameId || pick.eventId || pick.id, 180);

function normalized(value, limit = 180) {
  return clean(value, limit).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("sports_analytics_") && (text.includes("does not exist") || text.includes("schema cache"));
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
  const build = (existing, factory) => existing?.status === "ready" ? existing : factory(eventPick, observations, { now });
  return {
    nhl: build(pick.nhlXgGoalieShadowV1, buildNhlXgGoalieShadowV1),
    soccer: build(pick.soccerXgPoissonShadowV1, buildSoccerXgPoissonShadowV1),
    basketball: build(pick.basketballEfficiencyShadowV1, buildBasketballEfficiencyShadowV1),
    baseball: build(pick.mlbPitchingOffenseShadowV1, buildMlbPitchingOffenseShadowV1)
  };
}

function compactBinaryModel({ model, pick, family, sport, extra = {} }) {
  if (model?.status !== "ready" || !model.probabilities) return null;
  const home = finite(model.probabilities.home);
  const away = finite(model.probabilities.away);
  if (home === null || away === null) return null;
  return {
    modelId: clean(model.modelId, 160),
    modelVersion: clean(model.modelVersion || model.version, 160),
    family,
    sport,
    generatedAt: model.generatedAt || null,
    predictionHorizon: model.predictionHorizon || null,
    inputSnapshotHash: clean(model.inputSnapshotHash, 128),
    homeTeam: clean(pick.homeTeam, 140),
    awayTeam: clean(pick.awayTeam, 140),
    probabilities: { home, away },
    providers: Array.isArray(model.provenance?.providers) ? model.provenance.providers.slice(0, 10) : [],
    metrics: Array.isArray(model.provenance?.metrics) ? model.provenance.metrics.slice(0, 30) : [],
    calibrated: false,
    eventLevelHoldoutCapture: true,
    productionProbabilityChanged: false,
    paperOnly: true,
    ...extra
  };
}

function compactShadowModels(pick = {}, observations = [], capturedAt) {
  const rows = [];
  const { nhl, soccer, basketball, baseball } = eventLevelAdvancedModels(pick, observations, capturedAt);

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
      probabilities: { home: finite(nhl.homeMoneylineProbability), away: finite(nhl.awayMoneylineProbability) },
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

  const basketballRow = compactBinaryModel({ model: basketball, pick, family: "performance-statistics", sport: "basketball", extra: { projectedPoints: basketball?.projected || null } });
  if (basketballRow) rows.push(basketballRow);
  const baseballRow = compactBinaryModel({ model: baseball, pick, family: "expected-performance", sport: "baseball", extra: { matchup: baseball?.matchup || null } });
  if (baseballRow) rows.push(baseballRow);
  return rows;
}

function marketBenchmarkFromPick(pick = {}, capturedAt) {
  const rows = Array.isArray(pick.eventConsensusDistribution) ? pick.eventConsensusDistribution : [];
  const homeKey = normalized(pick.homeTeam, 140);
  const awayKey = normalized(pick.awayTeam, 140);
  const probabilities = {};
  const raw = [];

  for (const row of rows.slice(0, 5)) {
    const selection = normalized(row?.selection, 140);
    const probability = finite(row?.probability);
    if (!selection || probability === null || probability <= 0 || probability >= 1) continue;
    let side = null;
    if (selection === homeKey) side = "home";
    else if (selection === awayKey) side = "away";
    else if (["draw", "tie", "tasapeli", "x"].includes(selection)) side = "draw";
    if (!side || probabilities[side] !== undefined) continue;
    probabilities[side] = probability;
    raw.push({ side, selection: clean(row.selection, 140), probability, bookmakerCount: Number(row.bookmakerCount || 0), latestUpdate: row.latestUpdate || null });
  }

  const soccer = normalized(pick.sportKey || pick.sportTitle, 120).includes("soccer");
  const required = soccer ? ["home", "draw", "away"] : ["home", "away"];
  if (!required.every((side) => finite(probabilities[side]) !== null)) return null;
  const rawTotal = required.reduce((sum, side) => sum + Number(probabilities[side]), 0);
  if (!Number.isFinite(rawTotal) || rawTotal < 0.9 || rawTotal > 1.1) return null;
  const normalizedProbabilities = Object.fromEntries(required.map((side) => [side, Number((probabilities[side] / rawTotal).toFixed(8))]));

  return {
    version: "no-vig-event-market-benchmark-v1",
    source: "bookmaker-no-vig-consensus",
    independentPredictiveModel: false,
    marketKey: clean(pick.marketKey || "h2h", 60),
    capturedAt,
    rawProbabilityTotal: Number(rawTotal.toFixed(8)),
    renormalized: Math.abs(rawTotal - 1) > 0.000001,
    probabilities: normalizedProbabilities,
    outcomes: raw,
    productionProbabilityChanged: false,
    paperOnly: true
  };
}

async function storeEvent(admin, pick, capturedAt) {
  const automatic = buildAutomaticObservationsFromPick(pick, { capturedAt });
  const external = await fetchExternalSportsAnalytics(matchFromPick(pick), { capturedAt });
  const observations = mergeAnalyticsObservations(automatic, external.observations);
  const providerStatus = {
    automatic: { source: "scorecaster-unified-data", mode: automatic.length ? "live" : "unavailable", ok: automatic.length > 0, observationCount: automatic.length },
    external: { source: external.source, mode: external.mode, ok: external.ok, observationCount: external.observations.length, reason: external.reason || null }
  };
  const snapshot = buildSportsAnalyticsSnapshot({ pick, observations, golfShots: external.golfShots, providerStatus, capturedAt });
  if (!snapshot.event_id) return null;

  const shadowModels = compactShadowModels(pick, observations, capturedAt);
  const marketBenchmark = marketBenchmarkFromPick(pick, capturedAt);
  snapshot.raw_summary = {
    ...(snapshot.raw_summary || {}),
    shadowLedgerVersion: "advanced-shadow-prediction-ledger-v2",
    shadowModels,
    shadowModelCount: shadowModels.length,
    marketBenchmarkVersion: "no-vig-event-market-benchmark-v1",
    marketBenchmark,
    marketBenchmarkCapturedBeforeStart: Boolean(marketBenchmark),
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
    const { error: observationError } = await admin.from("sports_analytics_observations").upsert(observationRows, { onConflict: "fingerprint" });
    if (observationError) throw observationError;
  }

  return {
    snapshot: storedSnapshot,
    automaticObservations: automatic.length,
    externalObservations: external.observations.length,
    externalMode: external.mode,
    golfShots: external.golfShots.length,
    shadowModelsCaptured: shadowModels.length,
    marketBenchmarkCaptured: Boolean(marketBenchmark)
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
    const topPicksResponse = await fetch(`${origin}/api/top-picks`, { cache: "no-store", signal: AbortSignal.timeout(75_000) });
    const topPicks = await topPicksResponse.json();
    if (!topPicksResponse.ok || topPicks?.ok === false) return response({ ok: false, error: topPicks?.error || topPicks?.reason || "Top Picks unavailable" }, 503);

    const picks = uniqueEvents(Array.isArray(topPicks.data) ? topPicks.data : []);
    const settled = await Promise.allSettled(picks.map((pick) => storeEvent(admin, pick, capturedAt)));
    const stored = settled.filter((item) => item.status === "fulfilled" && item.value).map((item) => item.value);
    const failures = settled.filter((item) => item.status === "rejected");

    return response({
      ok: failures.length === 0,
      version: "sports-analytics-worker-v6",
      shadowLedgerVersion: "advanced-shadow-prediction-ledger-v2",
      marketBenchmarkVersion: "no-vig-event-market-benchmark-v1",
      capturedAt,
      eventsRequested: picks.length,
      eventsStored: stored.length,
      observationsStored: stored.reduce((sum, item) => sum + item.automaticObservations + item.externalObservations, 0),
      automaticObservations: stored.reduce((sum, item) => sum + item.automaticObservations, 0),
      externalObservations: stored.reduce((sum, item) => sum + item.externalObservations, 0),
      shadowModelsCaptured: stored.reduce((sum, item) => sum + item.shadowModelsCaptured, 0),
      marketBenchmarksCaptured: stored.filter((item) => item.marketBenchmarkCaptured).length,
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
      error: migrationMissing(error) ? "Sports analytics migration is not active" : process.env.NODE_ENV === "production" ? "Sports analytics capture failed" : String(error),
      migrationRequired: migrationMissing(error) ? "supabase/scorecaster_sports_analytics.sql" : undefined
    }, migrationMissing(error) ? 503 : 500);
  }
}
