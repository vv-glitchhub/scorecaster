import { loadIntelligenceForMatch } from "./intelligence-service";
import { fetchRecentLeagueResults } from "./results-provider.js";
import { attachFormRestShadow } from "./form-rest-shadow-model.mjs";
import {
  applySportsIntelligenceGate,
  buildSportsIntelligenceReport
} from "./sports-intelligence-v1.mjs";

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

  const [result, history] = await Promise.all([
    loadIntelligenceForMatch(match),
    fetchRecentLeagueResults({
      sportKey: pick.sportKey || pick.league,
      league: pick.leagueTitle || pick.league,
      now
    })
  ]);
  const report = result.report || buildSportsIntelligenceReport({
    match,
    intelligence: result.intelligence,
    now
  });
  const withShadow = attachFormRestShadow(pick, history, now);

  return applySportsIntelligenceGate(withShadow, report);
}
