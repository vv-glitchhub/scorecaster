import { loadIntelligenceForMatch } from "./intelligence-service";
import { fetchRecentLeagueResults } from "./results-provider.js";
import { attachFormRestShadow } from "./form-rest-shadow-model.mjs";
import { attachFormDepthProvenance } from "./form-depth-provenance-v1.mjs";
import { applyRestHistoryFreshnessGuardV1 } from "./rest-history-freshness-guard-v1.mjs";
import { attachHistoricalRatingShadow } from "./historical-rating-shadow-model.mjs";
import { loadPregameAdvancedShadowInputs } from "./sports-analytics-shadow-input-loader.js";
import { attachNhlXgGoalieShadowV1 } from "./nhl-xg-goalie-shadow-v1.mjs";
import { buildSoccerXgPoissonShadowV1 } from "./soccer-xg-poisson-shadow-v1.mjs";
import { buildBasketballEfficiencyShadowV1 } from "./basketball-efficiency-shadow-v1.mjs";
import { buildMlbPitchingOffenseShadowV1 } from "./mlb-pitching-offense-shadow-v1.mjs";
import { fetchPolymarketForMatch } from "./polymarket-fetcher.js";
import { applyPolymarketSafety } from "./polymarket-safety.mjs";
import {
  applySportsIntelligenceGate,
  buildSportsIntelligenceReport
} from "./sports-intelligence-v1.mjs";
import { loadUnifiedSportsData } from "./unified-sports-data-service";
import { applyUnifiedDataSafety } from "./unified-sports-data-v1.mjs";
import { buildUnifiedSportsDataLedgerWithLineupProvenance } from "./unified-lineup-provenance-v1.mjs";
import { attachIntelligenceFusionV2 } from "./intelligence-fusion-v2.mjs";
import { attachDecisionArchitectureV1 } from "./decision-architecture-v1.mjs";

function attachIndependentShadow(pick, snapshot, field) {
  const outputs = Array.isArray(pick.independentModelOutputs) ? [...pick.independentModelOutputs] : [];
  if (snapshot.status === "ready" && snapshot.independentModelOutput) outputs.push(snapshot.independentModelOutput);
  return { ...pick, [field]: snapshot, independentModelOutputs: outputs };
}

function attachSoccerXgShadow(pick, observations, now) {
  return attachIndependentShadow(pick, buildSoccerXgPoissonShadowV1(pick, observations, { now }), "soccerXgPoissonShadowV1");
}

function attachBasketballEfficiencyShadow(pick, observations, now) {
  return attachIndependentShadow(pick, buildBasketballEfficiencyShadowV1(pick, observations, { now }), "basketballEfficiencyShadowV1");
}

function attachMlbPitchingOffenseShadow(pick, observations, now) {
  return attachIndependentShadow(pick, buildMlbPitchingOffenseShadowV1(pick, observations, { now }), "mlbPitchingOffenseShadowV1");
}

export async function enrichPickWithLiveIntelligence(pick, { allowLiveSecondaryPricing = false } = {}) {
  const now = Date.now();
  const match = {
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    sport: pick.sportKey || pick.sportTitle,
    league: pick.league || pick.leagueTitle,
    commenceTime: pick.commenceTime || pick.commence_time,
    eventId: pick.gameId || pick.eventId || pick.id
  };

  const [result, history, polymarket, advancedShadowInputs] = await Promise.all([
    loadIntelligenceForMatch(match),
    fetchRecentLeagueResults({
      sportKey: pick.sportKey || pick.league,
      league: pick.leagueTitle || pick.league,
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      commenceTime: pick.commenceTime || pick.commence_time,
      now
    }),
    fetchPolymarketForMatch(match, { now }),
    loadPregameAdvancedShadowInputs(pick, { now })
  ]);
  const report = result.report || buildSportsIntelligenceReport({ match, intelligence: result.intelligence, now });
  const withFormDepth = attachFormDepthProvenance(attachFormRestShadow(pick, history, now), history);
  const withFormRest = applyRestHistoryFreshnessGuardV1(withFormDepth, { now });
  const withHistoricalRating = attachHistoricalRatingShadow(withFormRest, history, now);
  const withAdvancedStatus = {
    ...withHistoricalRating,
    advancedShadowInputStatus: {
      ok: advancedShadowInputs.ok === true,
      sport: advancedShadowInputs.sport || null,
      mode: advancedShadowInputs.mode,
      providerCount: advancedShadowInputs.providerCount || 0,
      newestObservedAt: advancedShadowInputs.newestObservedAt || null,
      horizon: advancedShadowInputs.horizon || null,
      reason: advancedShadowInputs.reason || null,
      cached: advancedShadowInputs.cached === true
    },
    nhlAdvancedShadowInputStatus: {
      ok: advancedShadowInputs.sport === "ice_hockey" && advancedShadowInputs.ok === true,
      mode: advancedShadowInputs.mode,
      providerCount: advancedShadowInputs.sport === "ice_hockey" ? advancedShadowInputs.providerCount || 0 : 0,
      newestObservedAt: advancedShadowInputs.sport === "ice_hockey" ? advancedShadowInputs.newestObservedAt || null : null,
      horizon: advancedShadowInputs.horizon || null,
      reason: advancedShadowInputs.sport === "ice_hockey" ? advancedShadowInputs.reason || null : "not-applicable",
      cached: advancedShadowInputs.cached === true
    },
    basketballAdvancedShadowInputStatus: {
      ok: advancedShadowInputs.sport === "basketball" && advancedShadowInputs.ok === true,
      mode: advancedShadowInputs.mode,
      providerCount: advancedShadowInputs.sport === "basketball" ? advancedShadowInputs.providerCount || 0 : 0,
      newestObservedAt: advancedShadowInputs.sport === "basketball" ? advancedShadowInputs.newestObservedAt || null : null,
      horizon: advancedShadowInputs.horizon || null,
      reason: advancedShadowInputs.sport === "basketball" ? advancedShadowInputs.reason || null : "not-applicable",
      cached: advancedShadowInputs.cached === true
    },
    mlbAdvancedShadowInputStatus: {
      ok: advancedShadowInputs.sport === "baseball" && advancedShadowInputs.ok === true,
      mode: advancedShadowInputs.mode,
      providerCount: advancedShadowInputs.sport === "baseball" ? advancedShadowInputs.providerCount || 0 : 0,
      newestObservedAt: advancedShadowInputs.sport === "baseball" ? advancedShadowInputs.newestObservedAt || null : null,
      horizon: advancedShadowInputs.horizon || null,
      reason: advancedShadowInputs.sport === "baseball" ? advancedShadowInputs.reason || null : "not-applicable",
      cached: advancedShadowInputs.cached === true
    }
  };
  const withNhlXgGoalie = attachNhlXgGoalieShadowV1(withAdvancedStatus, advancedShadowInputs.observations, { now });
  const withSoccerXg = attachSoccerXgShadow(withNhlXgGoalie, advancedShadowInputs.observations, now);
  const withBasketballEfficiency = attachBasketballEfficiencyShadow(withSoccerXg, advancedShadowInputs.observations, now);
  const withMlbPitchingOffense = attachMlbPitchingOffenseShadow(withBasketballEfficiency, advancedShadowInputs.observations, now);
  const withSportsEvidence = applySportsIntelligenceGate(withMlbPitchingOffense, report);
  const withPolymarket = (() => {
    return applyPolymarketSafety(withSportsEvidence, polymarket);
  })();

  try {
    const unified = await loadUnifiedSportsData(withPolymarket, report, { now, allowLiveSecondaryPricing });
    const enriched = {
      ...applyUnifiedDataSafety(withPolymarket, unified.ledger),
      unifiedDataProviders: unified.providers,
      unifiedDataCached: unified.cached,
      unifiedDataGeneratedAt: unified.generatedAt,
      secondaryPricingAcquisition: unified.acquisitionMode || "worker-only"
    };
    const fused = attachIntelligenceFusionV2(enriched, { now });
    return attachDecisionArchitectureV1(fused, { now });
  } catch (error) {
    const ledger = buildUnifiedSportsDataLedgerWithLineupProvenance({ pick: withPolymarket, sportsReport: report, now });
    const enriched = {
      ...applyUnifiedDataSafety(withPolymarket, ledger),
      unifiedDataError: process.env.NODE_ENV === "production" ? undefined : error?.message,
      unifiedDataProviders: {},
      unifiedDataCached: false,
      unifiedDataGeneratedAt: new Date(now).toISOString(),
      secondaryPricingAcquisition: allowLiveSecondaryPricing ? "live-worker-capture" : "worker-only"
    };
    const fused = attachIntelligenceFusionV2(enriched, { now });
    return attachDecisionArchitectureV1(fused, { now });
  }
}
