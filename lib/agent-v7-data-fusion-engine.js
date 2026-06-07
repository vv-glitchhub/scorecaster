import { buildAgentV6Pick } from "./agent-v6-engine";
import { buildIntelligence } from "./intelligence-engine";
import { calculateMarketSentiment } from "./market-sentiment-engine";
import { calculatePickQuality } from "./pick-quality-engine";
import { promoteBetDecision } from "./bet-promotion-engine";
import { calculateMatchContext } from "./match-context-engine";
import { calculateSharpMoneySignal } from "./sharp-money-engine";

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

  const marketPick = {
    ...pick,
    lineMovement: marketInput.lineMovement ?? pick.lineMovement,
    oddsMovement: marketInput.oddsMovement ?? pick.oddsMovement,
    openingOdds: marketInput.openingOdds ?? pick.openingOdds,
    currentOdds: marketInput.currentOdds ?? pick.currentOdds ?? pick.odds,
    bestOdds: marketInput.bestOdds ?? pick.bestOdds ?? pick.odds,
    averageOdds: marketInput.averageOdds ?? pick.averageOdds ?? pick.marketAverageOdds,
    bookmakerCount: marketInput.bookmakerCount ?? pick.bookmakerCount
  };

  const matchContext = calculateMatchContext({
    ...marketPick,
    injuriesCount: injuries.length || pick.injuriesCount,
    keyPlayerOut: pick.keyPlayerOut || pick.selectedKeyPlayerOut
  });

  const sharpMoney = calculateSharpMoneySignal(marketPick);

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
    polymarketMarkets: intelligence.polymarket?.data || [],
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    league: pick.leagueTitle || pick.league || pick.sportTitle || pick.sportKey,
    sport: pick.sportTitle || pick.sportKey
  });

  const edgeScore = calculateEdgeScore(pick.edge);
  const sourceTrustAdjustment = calculateSourceTrustAdjustment(builtIntelligence.sourceTrust);
  const readinessAdjustment = calculateReadinessAdjustment(basePick.readiness?.level);
  const riskAdjustment = calculateRiskAdjustment(basePick.riskLevel);

  const preliminaryScore =
    Number(basePick.finalScore || 0) +
    Number(builtIntelligence.totalScore || 0) +
    Number(sentiment.sentimentScore || 0) +
    Number(matchContext.totalScore || 0) +
    Number(sharpMoney.score || 0) +
    Number(edgeScore || 0) +
    Number(sourceTrustAdjustment || 0) +
    Number(readinessAdjustment || 0) +
    Number(riskAdjustment || 0);

  const quality = calculatePickQuality({
    ...pick,
    finalScore: preliminaryScore,
    sourceTrust: builtIntelligence.sourceTrust,
    sentimentScore: sentiment.sentimentScore
  });

  const qualityAdjustment = calculateQualityAdjustment(quality.qualityGrade);

  const dataFusionScore =
    Number(builtIntelligence.totalScore || 0) +
    Number(sentiment.sentimentScore || 0) +
    Number(matchContext.totalScore || 0) +
    Number(sharpMoney.score || 0) +
    Number(edgeScore || 0) +
    Number(sourceTrustAdjustment || 0) +
    Number(readinessAdjustment || 0) +
    Number(riskAdjustment || 0) +
    Number(qualityAdjustment || 0);

  const finalScore = Number(basePick.finalScore || 0) + dataFusionScore;

  const baseDecision = decideFromV7Score({
    finalScore,
    edge: pick.edge,
    readinessLevel: basePick.readiness?.level,
    sourceTrust: builtIntelligence.sourceTrust,
    riskLevel: basePick.riskLevel,
    qualityGrade: quality.qualityGrade
  });

  const promotion = promoteBetDecision({
    ...pick,
    decision: baseDecision,
    finalScore,
    qualityScore: quality.qualityScore,
    qualityGrade: quality.qualityGrade,
    sourceTrust: builtIntelligence.sourceTrust,
    sentimentScore: sentiment.sentimentScore,
    riskLevel: basePick.riskLevel
  });

  const decision = promotion.decision;

  const fusionNotes = [
    ...builtIntelligence.notes,
    ...sentiment.notes,
    ...matchContext.notes,
    ...sharpMoney.notes,
    ...quality.qualityNotes,
    ...promotion.promotionNotes,
    `Match context: ${matchContext.grade} (${matchContext.totalScore.toFixed(3)}).`,
    `Sharp money: ${sharpMoney.label} (${sharpMoney.score.toFixed(3)}).`,
    `Edge score adjustment: ${edgeScore.toFixed(3)}.`,
    `Pick quality: ${quality.qualityGrade} (${quality.qualityScore.toFixed(3)}).`,
    `Promotion score: ${promotion.promotionScore.toFixed(3)}.`,
    sourceTrustAdjustment > 0
      ? "High source trust improves confidence."
      : sourceTrustAdjustment < 0
      ? "Low source trust reduces confidence."
      : "Source trust is neutral.",
    readinessAdjustment < 0 ? "Low readiness reduces confidence." : "Readiness is acceptable.",
    riskAdjustment < 0 ? "Risk engine reduced confidence." : "Risk level is acceptable."
  ];

  return {
    ...basePick,
    agentVersion: "V7",
    finalScore,
    decision,
    baseDecision,
    promotionScore: promotion.promotionScore,
    promotionNotes: promotion.promotionNotes,
    dataFusionScore,
    edgeScore,
    matchContext,
    matchContextScore: matchContext.totalScore,
    matchContextGrade: matchContext.grade,
    sharpMoney,
    sharpMoneyScore: sharpMoney.score,
    sharpMoneyLabel: sharpMoney.label,
    qualityScore: quality.qualityScore,
    qualityGrade: quality.qualityGrade,
    qualityNotes: quality.qualityNotes,
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
        edgeScore,
        matchContextScore: matchContext.totalScore,
        matchContextGrade: matchContext.grade,
        sharpMoneyScore: sharpMoney.score,
        sharpMoneyLabel: sharpMoney.label,
        qualityScore: quality.qualityScore,
        qualityGrade: quality.qualityGrade,
        promotionScore: promotion.promotionScore,
        sentimentScore: sentiment.sentimentScore,
        intelligenceScore: builtIntelligence.totalScore
      },
      dataFusion: {
        score: dataFusionScore,
        edgeScore,
        matchContext,
        sharpMoney,
        promotion,
        quality,
        sourceTrust: builtIntelligence.sourceTrust,
        sentiment,
        notes: fusionNotes
      },
      news: [...(basePick.report?.news || []), ...fusionNotes]
    }
  };
}

function buildSources({ intelligence, newsItems }) {
  const sources = [{ type: "odds_market", name: "Odds API" }];

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

function calculateEdgeScore(edge = 0) {
  const value = Number(edge || 0);
  if (value >= 0.08) return 0.055;
  if (value >= 0.05) return 0.04;
  if (value >= 0.03) return 0.02;
  if (value <= -0.03) return -0.04;
  return 0;
}

function calculateQualityAdjustment(grade) {
  if (grade === "A") return 0.035;
  if (grade === "B") return 0.02;
  if (grade === "C") return 0.008;
  if (grade === "D") return -0.008;
  return -0.02;
}

function calculateSourceTrustAdjustment(score = 0.2) {
  if (score >= 0.85) return 0.02;
  if (score >= 0.7) return 0.012;
  if (score >= 0.4) return 0;
  if (score >= 0.25) return -0.008;
  return -0.025;
}

function calculateReadinessAdjustment(level) {
  if (level === "High") return 0.01;
  if (level === "Medium") return 0;
  if (level === "Low") return -0.015;
  return 0;
}

function calculateRiskAdjustment(level) {
  if (level === "Low") return 0.005;
  if (level === "Medium") return 0;
  if (level === "High") return -0.025;
  return 0;
}

function decideFromV7Score({ finalScore, edge, readinessLevel, sourceTrust, riskLevel, qualityGrade }) {
  const edgeValue = Number(edge || 0);

  if (riskLevel === "High" && finalScore < 0.12) return "WAIT";
  if (readinessLevel === "Low" && sourceTrust < 0.35 && finalScore < 0.12) return "WAIT";

  if (["A", "B"].includes(qualityGrade) && finalScore >= 0.095 && edgeValue >= 0.04) return "BET";
  if (finalScore >= 0.105 && edgeValue >= 0.035) return "BET";
  if (finalScore >= 0.055) return "WATCH";
  if (finalScore >= 0.02) return "WAIT";
  return "PASS";
}
