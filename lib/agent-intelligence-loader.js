import { loadIntelligenceForMatch } from "./intelligence-service";
import { buildAgentV7Pick } from "./agent-v7-data-fusion-engine";

export async function enrichPickWithLiveIntelligence(pick) {
  const intelligence = await loadIntelligenceForMatch({
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    sport: pick.sportKey || pick.sportTitle,
    league: pick.league || pick.leagueTitle
  });

  return buildAgentV7Pick({
    pick,
    trackedBets: pick.trackedBets || [],
    learningBoost: pick.confidenceBoost || 0,
    movementSignal: pick.movementSignal || "Stable",
    contextInput: pick.contextInput || {},
    marketInput: {
      clv: pick.clv || 0,
      polymarketDifference: pick.polymarketDifference || 0
    },
    intelligence
  });
}
