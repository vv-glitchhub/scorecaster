import { buildAgentV4Pick } from "./agent-v4-engine";
import { analyzeNews } from "./news-intelligence-engine";
import { calculateInjuryImpact } from "./injury-engine";
import { calculateLineupScore } from "./lineup-engine";

export function buildAgentV5Pick({
  pick,
  learningBoost = 0,
  movementSignal = "Stable",
  contextInput = {},
  marketInput = {},
  newsItems = [],
  injuries = [],
  lineup = {}
}) {
  const news = analyzeNews(newsItems);
  const injury = calculateInjuryImpact(injuries);
  const lineupResult = calculateLineupScore(lineup);

  const enhancedContext = {
    ...contextInput,
    news: newsItems,
    injuries: injuries.length,
    lineup: lineupResult.lineupScore,
    sources: [
      ...(contextInput.sources || []),
      ...(newsItems || []).map((item) => ({
        type: item.sourceType || "unknown",
        name: item.source || "News source"
      }))
    ]
  };

  const basePick = buildAgentV4Pick({
    pick,
    learningBoost,
    movementSignal,
    contextInput: enhancedContext,
    marketInput
  });

  const finalScore =
    Number(basePick.finalScore || 0) +
    Number(news.newsScore || 0) +
    Number(injury.injuryScore || 0) +
    Number(lineupResult.lineupScore || 0);

  const extraNotes = [
    ...news.notes,
    ...injury.notes,
    ...lineupResult.notes
  ];

  return {
    ...basePick,
    agentVersion: "V5",
    finalScore,
    newsScore: news.newsScore,
    injuryScore: injury.injuryScore,
    lineupScore: lineupResult.lineupScore,
    newsNotes: news.notes,
    injuryNotes: injury.notes,
    lineupNotes: lineupResult.notes,
    contextNotes: [...(basePick.contextNotes || []), ...extraNotes],
    report: {
      ...basePick.report,
      news: [...(basePick.report?.news || []), ...extraNotes],
      model: {
        ...basePick.report?.model,
        finalScore
      }
    }
  };
}
