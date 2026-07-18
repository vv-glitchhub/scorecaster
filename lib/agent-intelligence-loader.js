import { loadIntelligenceForMatch } from "./intelligence-service";
import {
  applySportsIntelligenceGate,
  buildSportsIntelligenceReport
} from "./sports-intelligence-v1.mjs";

function resolveOrigin(pick) {
  if (pick.origin) return pick.origin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}

export async function enrichPickWithLiveIntelligence(pick) {
  const match = {
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    sport: pick.sportKey || pick.sportTitle,
    league: pick.league || pick.leagueTitle,
    commenceTime: pick.commenceTime || pick.commence_time,
    eventId: pick.gameId || pick.eventId || pick.id
  };

  const result = await loadIntelligenceForMatch({
    ...match,
    origin: resolveOrigin(pick)
  });
  const report = result.report || buildSportsIntelligenceReport({
    match,
    intelligence: result.intelligence
  });

  return applySportsIntelligenceGate(pick, report);
}
