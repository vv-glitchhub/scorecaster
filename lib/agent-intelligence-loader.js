import { loadIntelligenceForMatch } from "./intelligence-service";
import { fetchRecentLeagueResults } from "./results-provider.js";
import { attachFormRestShadow } from "./form-rest-shadow-model.mjs";
import { attachHistoricalRatingShadow } from "./historical-rating-shadow-model.mjs";
import { loadPregameAdvancedShadowInputs } from "./sports-analytics-shadow-input-loader.js";
import { attachNhlXgGoalieShadowV1 } from "./nhl-xg-goalie-shadow-v1.mjs";
import { fetchPolymarketForMatch } from "./polymarket-fetcher.js";
import { applyPolymarketSafety } from "./polymarket-safety.mjs";
import {
  applySportsIntelligenceGate,
  buildSportsIntelligenceReport
} from "./sports-intelligence-v1.mjs";
import { loadUnifiedSportsData } from "./unified-sports-data-service";
import { applyUnifiedDataSafety, buildUnifiedSportsDataLedger } from "./unified-sports-data-v1.mjs";
import { attachIntelligenceFusionV2 } from "./intelligence-fusion-v2.mjs";
import { attachDecisionArchitectureV1 } from "./decision-architecture-v1.mjs";

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
      now
    }),
    fetchPolymarketForMatch(match, { now }),
    loadPregameAdvancedShadowInputs(pick, { now })
  ]);
  const report = result.report || buildSportsIntelligenceReport({
    match,
    intelligence: result.intelligence,
    now
  });
  const withFormRest = attachFormRestShadow(pick, history, now);
  const withHistoricalRating = attachHistoricalRatingShadow(withFormRest, history, now);
  const withAdvancedStatus = {
    ...withHistoricalRating,
    nhlAdvancedShadowInputStatus: {
      ok: advancedShadowInputs.ok === true,
      mode: advancedShadowInputs.mode,
      providerCount: advancedShadowInputs.providerCount || 0,
      newestObservedAt: advancedShadowInputs.newestObservedAt || null,
      horizon: advancedShadowInputs.horizon || null,
      reason: advancedShadowInputs.reason || null,
      cached: advancedShadowInputs.cached === true
    }
  };
  const withNhlXgGoalie = attachNhlXgGoalieShadowV1(withAdvancedStatus, advancedShadowInputs.observations, { now });
  const withSportsEvidence = applySportsIntelligenceGate(withNhlXgGoalie, report);
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
    const ledger = buildUnifiedSportsDataLedger({ pick: withPolymarket, sportsReport: report, now });
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
