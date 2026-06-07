import { loadIntelligenceForMatch } from "./intelligence-service";
import { buildAgentV7Pick } from "./agent-v7-data-fusion-engine";

function resolveOrigin(pick) {
  if (pick.origin) return pick.origin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}

export async function enrichPickWithLiveIntelligence(pick) {
  const intelligence = await loadIntelligenceForMatch({
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    sport: pick.sportKey || pick.sportTitle,
    league: pick.league || pick.leagueTitle,
    origin: resolveOrigin(pick)
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
