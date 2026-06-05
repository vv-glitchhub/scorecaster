import { analyzeNews } from "./news-intelligence-engine";
import { calculateInjuryImpact } from "./injury-engine";
import { calculateLineupScore } from "./lineup-engine";
import { calculateSourceTrust } from "./source-trust-engine";

export function buildIntelligence({
  news = [],
  injuries = [],
  lineup = {},
  sources = []
}) {
  const newsResult = analyzeNews(news);

  const injuryResult =
    calculateInjuryImpact(injuries);

  const lineupResult =
    calculateLineupScore(lineup);

  const trust =
    calculateSourceTrust(sources);

  const totalScore =
    Number(newsResult.newsScore || 0) +
    Number(injuryResult.injuryScore || 0) +
    Number(lineupResult.lineupScore || 0);

  return {
    totalScore,

    sourceTrust: trust.score,
    sourceTrustLabel: trust.label,

    newsScore: newsResult.newsScore,
    injuryScore: injuryResult.injuryScore,
    lineupScore: lineupResult.lineupScore,

    notes: [
      ...newsResult.notes,
      ...injuryResult.notes,
      ...lineupResult.notes
    ]
  };
}
