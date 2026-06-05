import { loadIntelligenceForMatch } from "./intelligence-service";
import { buildIntelligence } from "./intelligence-engine";

export async function enrichPickWithLiveIntelligence(pick) {
  const intelligence = await loadIntelligenceForMatch({
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    sport: pick.sportKey || pick.sportTitle,
    league: pick.league || pick.leagueTitle
  });

  const built = buildIntelligence({
    news: intelligence.news?.data || [],
    injuries: intelligence.injuries?.data || [],
    lineup: intelligence.lineup?.data || {},
    sources: [
      { type: "odds_market", name: "Odds API" },
      { type: "unknown", name: "External intelligence placeholder" }
    ]
  });

  return {
    ...pick,
    intelligence,
    intelligenceScore: built.totalScore,
    newsScore: built.newsScore,
    injuryScore: built.injuryScore,
    lineupScore: built.lineupScore,
    intelligenceNotes: built.notes,
    sourceTrust: built.sourceTrust,
    sourceTrustLabel: built.sourceTrustLabel,
    finalScore: Number(pick.finalScore || 0) + Number(built.totalScore || 0)
  };
}
