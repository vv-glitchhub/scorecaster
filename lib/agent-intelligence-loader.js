import { loadIntelligenceForMatch } from "./intelligence-service";
import {
  applySportsIntelligenceGate,
  buildSportsIntelligenceReport
} from "./sports-intelligence-v1.mjs";

export async function enrichPickWithLiveIntelligence(pick) {
  const match = {
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    sport: pick.sportKey || pick.sportTitle,
    league: pick.league || pick.leagueTitle,
    commenceTime: pick.commenceTime || pick.commence_time,
    eventId: pick.gameId || pick.eventId || pick.id
  };

  const result = await loadIntelligenceForMatch(match);
  const report = result.report || buildSportsIntelligenceReport({
    match,
    intelligence: result.intelligence
  });

  return applySportsIntelligenceGate(pick, report);
}
