import { buildAgentV6Pick } from "./agent-v6-engine";
import { buildIntelligence } from "./intelligence-engine";
import { calculateMarketSentiment } from "./market-sentiment-engine";

export function buildAgentV7Pick({
  pick,
  trackedBets = [],
  learningBoost = 0,
  movementSignal = "Stable",
  contextInput = {},
  marketInput = {},
  intelligence = {}
}) {
  const newsItems = intelligence.news?.data || pick.newsItems || [];
  const injuries = intelligence.injuries?.data || pick.injuries || [];
  const lineup = intelligence.lineup?.data || {
    startersConfirmed: Boolean(pick.startersConfirmed),
    goalieConfirmed: Boolean(pick.goalieConfirmed),
    keyPlayersAvailable: pick.keyPlayersAvailable !== false,
    lineupStability: Number(pick.lineupStability || 0)
  };

  const basePick = buildAgentV6Pick({
    pick,
    trackedBets,
    learningBoost,
    movementSignal,
    contextInput: {
      ...contextInput,
      news: newsItems,
      injuries: injuries.length,
      lineup: lineup.lineupStability || 0
    },
    marketInput,
    newsItems,
    injuries,
    lineup
  });

  const builtIntelligence = buildIntelligence({
    news: newsItems,
    injuries,
    lineup,
    sources: buildSources({ intelligence, newsItems })
  });

  const bookmakerProbability = Number(
    pick.marketProbability ||
      pick.impliedProbability ||
      (pick.odds ? 1 / Number(pick.odds) : 0)
  );

  const sentiment = calculateMarketSentiment({
    modelProbability: Number(pick.modelProbability || 0),
    bookmakerProbability,
    polymarketMarkets: intelligence.polymarket?.data || []
  });

  const sourceTrustAdjustment = calculateSourceTrustAdjustment(
    builtIntelligence.sourceTrust
  );

  const dataFusionScore =
    Number(builtIntelligence.totalScore || 0) +
    Number(sentiment.sentimentScore || 0) +
    Number(sourceTrustAdjustment || 0);

  const finalScore = Number(basePick.finalScore || 0) + dataFusionScore;

  const decision = decideFromV7Score({
    finalScore,
    readinessLevel: basePick.readiness?.level,
    sourceTrust: builtIntelligence.sourceTrust,
    riskLevel: basePick.riskLevel
  });

  const fusionNotes = [
    ...builtIntelligence.notes,
    ...sentiment.notes,
    sourceTrustAdjustment > 0
      ? "High source trust improves confidence."
      : sourceTrustAdjustment < 0
      ? "Low source trust reduces confidence."
      : "Source trust is neutral."
  ];

  return {
    ...basePick,
    agentVersion: "V7",
    finalScore,
    decision,
    dataFusionScore,
    sourceTrust: builtIntelligence.sourceTrust,
    sourceTrustLabel: builtIntelligence.sourceTrustLabel,
    sentiment,
    sentimentScore: sentiment.sentimentScore,
    sentimentNotes: sentiment.notes,
    intelligenceScore: builtIntelligence.totalScore,
    intelligenceNotes: builtIntelligence.notes,
    fusionNotes,
    report: {
      ...basePick.report,
      agentVersion: "V7",
      model: {
        ...basePick.report?.model,
        finalScore,
        dataFusionScore,
        sentimentScore: sentiment.sentimentScore,
        intelligenceScore: builtIntelligence.totalScore
      },
      dataFusion: {
        score: dataFusionScore,
        sourceTrust: builtIntelligence.sourceTrust,
        sentiment,
        notes: fusionNotes
      },
      news: [...(basePick.report?.news || []), ...fusionNotes]
    }
  };
}

function buildSources({ intelligence, newsItems }) {
  const sources = [
    { type: "odds_market", name: "Odds API" }
  ];

  if (intelligence.news?.mode === "live") {
    sources.push({ type: "major_media", name: "NewsAPI" });
  }

  if (intelligence.injuries?.mode === "live") {
    sources.push({ type: "official_data_provider", name: "SportsData" });
  }

  if (intelligence.lineup?.mode === "live") {
    sources.push({ type: "official_data_provider", name: "SportsData" });
  }

  if (intelligence.polymarket?.mode === "live") {
    sources.push({ type: "polymarket", name: "Polymarket" });
  }

  for (const item of newsItems || []) {
    sources.push({
      type: item.sourceType || "unknown",
      name: item.source || "News source"
    });
  }

  return sources;
}

function calculateSourceTrustAdjustment(score = 0.2) {
  if (score >= 0.85) return 0.02;
  if (score >= 0.7) return 0.01;
  if (score >= 0.5) return 0;
  if (score >= 0.3) return -0.01;
  return -0.03;
}

function decideFromV7Score({ finalScore, readinessLevel, sourceTrust, riskLevel }) {
  if (readinessLevel === "Low" && sourceTrust < 0.5) return "WAIT";
  if (riskLevel === "High" && finalScore < 0.1) return "WAIT";
  if (finalScore >= 0.13 && sourceTrust >= 0.55) return "BET";
  if (finalScore >= 0.07) return "WATCH";
  if (finalScore >= 0.025) return "WAIT";
  return "PASS";
}
