import { loadIntelligenceForMatch } from "./intelligence-service";
import { fetchRecentLeagueResults } from "./results-provider.js";
import { attachFormRestShadow } from "./form-rest-shadow-model.mjs";
import { fetchPolymarketForMatch } from "./polymarket-fetcher.js";
import { applyPolymarketSafety } from "./polymarket-safety.mjs";
import {
  applySportsIntelligenceGate,
  buildSportsIntelligenceReport
} from "./sports-intelligence-v1.mjs";
import { loadUnifiedSportsData } from "./unified-sports-data-service";
import { applyUnifiedDataSafety, buildUnifiedSportsDataLedger } from "./unified-sports-data-v1.mjs";

export async function enrichPickWithLiveIntelligence(pick) {
  const now = Date.now();
  const match = {
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    sport: pick.sportKey || pick.sportTitle,
    league: pick.league || pick.leagueTitle,
    commenceTime: pick.commenceTime || pick.commence_time,
    eventId: pick.gameId || pick.eventId || pick.id
  };

  const [result, history, polymarket] = await Promise.all([
    loadIntelligenceForMatch(match),
    fetchRecentLeagueResults({
      sportKey: pick.sportKey || pick.league,
      league: pick.leagueTitle || pick.league,
      now
    }),
    fetchPolymarketForMatch(match, { now })
  ]);
  const report = result.report || buildSportsIntelligenceReport({
    match,
    intelligence: result.intelligence,
    now
  });
  const withShadow = attachFormRestShadow(pick, history, now);
  const withSportsEvidence = applySportsIntelligenceGate(withShadow, report);
  const withPolymarket = applyPolymarketSafety(withSportsEvidence, polymarket);

  try {
    const unified = await loadUnifiedSportsData(withPolymarket, report, { now });
    return {
      ...applyUnifiedDataSafety(withPolymarket, unified.ledger),
      unifiedDataProviders: unified.providers,
      unifiedDataCached: unified.cached,
      unifiedDataGeneratedAt: unified.generatedAt
    };
  } catch (error) {
    const ledger = buildUnifiedSportsDataLedger({ pick: withPolymarket, sportsReport: report, now });
    return {
      ...applyUnifiedDataSafety(withPolymarket, ledger),
      unifiedDataError: process.env.NODE_ENV === "production" ? undefined : error?.message,
      unifiedDataProviders: {},
      unifiedDataCached: false,
      unifiedDataGeneratedAt: new Date(now).toISOString()
    };
  }
}
