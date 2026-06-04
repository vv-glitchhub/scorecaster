import { determineDecision } from "./agent-decision-engine";
import {
  calculateContextScore,
  summarizeContext
} from "./context-intelligence-engine";
import { calculateMarketSignal } from "./market-intelligence-engine";
import { generateAgentReport } from "./agent-report-engine";
import {
  checkDataReadiness,
  getReadinessRecommendation
} from "./data-readiness-engine";

export function buildAgentV4Pick({
  pick,
  learningBoost = 0,
  movementSignal = "Stable",
  contextInput = {},
  marketInput = {}
}) {
  const context = calculateContextScore(contextInput);
  const contextNotes = summarizeContext(context);

  const market = calculateMarketSignal({
    movementSignal,
    bookmaker: pick.bookmaker,
    clv: marketInput.clv || 0,
    polymarketDifference: marketInput.polymarketDifference || 0
  });

  const readiness = checkDataReadiness({
    hasOdds: Boolean(pick.odds),
    hasBestBookmaker: Boolean(pick.bookmaker),
    hasLineMovement: movementSignal !== "Stable",
    hasPolymarket: Boolean(marketInput.polymarketDifference),
    hasNews: Boolean(contextInput.news?.length),
    hasInjuries: contextInput.injuries !== undefined,
    hasLineups: contextInput.lineup !== undefined,
    hasSourceTrust: Boolean(contextInput.sources?.length)
  });

  const readinessRecommendation = getReadinessRecommendation(readiness);
  const sourceTrust = context.sourceTrust;

  const readinessPenalty =
    readiness.level === "Low" ? -0.03 : readiness.level === "Medium" ? -0.01 : 0;

  const finalScore =
    Number(pick.edge || 0) +
    Number(pick.ev || 0) * 0.25 +
    Number(learningBoost || 0) +
    Number(context.contextScore || 0) +
    Number(market.marketScore || 0) +
    readinessPenalty;

  const riskLevel =
    readiness.level === "Low"
      ? "High"
      : finalScore >= 0.08 && sourceTrust >= 0.7
      ? "Low"
      : finalScore >= 0.04
      ? "Medium"
      : "High";

  const decisionResult = determineDecision({
    edge: pick.edge,
    ev: pick.ev,
    confidence: pick.confidence,
    riskLevel,
    sourceTrust
  });

  const report = generateAgentReport({
    match: pick.match,
    selection: pick.selection,
    odds: pick.odds,
    marketProbability: pick.marketProbability,
    modelProbability: pick.modelProbability,
    edge: pick.edge,
    ev: pick.ev,
    confidence: pick.confidence,
    decision: decisionResult.decision,
    decisionReason: decisionResult.reason,
    contextScore: context.contextScore,
    movementScore: movementSignal,
    sourceTrust,
    news: [
      ...contextNotes,
      ...market.notes,
      readinessRecommendation,
      readiness.missing.length
        ? `Missing data: ${readiness.missing.join(", ")}`
        : "No major missing data."
    ]
  });

  return {
    ...pick,
    agentVersion: "V4",
    finalScore,
    context,
    contextNotes,
    market,
    marketNotes: market.notes,
    marketScore: market.marketScore,
    readiness,
    readinessRecommendation,
    readinessPenalty,
    sourceTrust,
    sourceTrustLabel: context.sourceTrustLabel,
    riskLevel,
    decision: decisionResult.decision,
    decisionReason: decisionResult.reason,
    report
  };
}
