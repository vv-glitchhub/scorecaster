import { loadIntelligenceForMatch } from "./intelligence-service";
import { buildAgentV7Pick } from "./agent-v7-data-fusion-engine";
import { applyEvidenceGate } from "./intelligence-readiness.mjs";

function resolveOrigin(pick) {
  if (pick.origin) return pick.origin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}

export async function enrichPickWithLiveIntelligence(pick) {
  const result = await loadIntelligenceForMatch({
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    sport: pick.sportKey || pick.sportTitle,
    league: pick.league || pick.leagueTitle,
    origin: resolveOrigin(pick)
  });

  const fused = buildAgentV7Pick({
    pick,
    trackedBets: pick.trackedBets || [],
    learningBoost: pick.confidenceBoost || 0,
    movementSignal: pick.movementSignal || "Stable",
    contextInput: pick.contextInput || {},
    marketInput: {
      clv: pick.clv || 0,
      polymarketDifference: 0
    },
    intelligence: result.intelligence
  });

  return applyEvidenceGate(fused, result.readiness);
}
