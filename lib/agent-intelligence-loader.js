import { loadIntelligenceForMatch } from "./intelligence-service";
import {
  attachVerifiedSportsIntelligence,
  buildVerifiedSportsIntelligence
} from "./verified-sports-intelligence.mjs";

export async function enrichPickWithLiveIntelligence(pick) {
  const raw = await loadIntelligenceForMatch({
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    sport: pick.sportKey || pick.sportTitle,
    league: pick.league || pick.leagueTitle
  });

  const report = buildVerifiedSportsIntelligence({
    news: raw.news,
    injuries: raw.injuries,
    lineup: raw.lineup,
    externalMarkets: raw.polymarket,
    commenceTime: pick.commenceTime
  });

  return attachVerifiedSportsIntelligence(pick, report);
}
