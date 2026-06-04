import { determineDecision } from "./agent-decision-engine";
import { calculateContextScore, summarizeContext } from "./context-intelligence-engine";
import { generateAgentReport } from "./agent-report-engine";

export function buildAgentV4Pick({
  pick,
  learningBoost = 0,
  movementSignal = "Stable",
  contextInput = {}
}) {
  const context = calculateContextScore(contextInput);
  const contextNotes = summarizeContext(context);

  const sourceTrust = context.sourceTrust;

  const finalScore =
    Number(pick.edge || 0) +
    Number(pick.ev || 0) * 0.25 +
    Number(learningBoost || 0) +
    Number(context.contextScore || 0);

  const riskLevel =
    finalScore >= 0.08 && sourceTrust >= 0.7
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
    news: contextNotes
  });

  return {
    ...pick,
    agentVersion: "V4",
    finalScore,
    context,
    contextNotes,
    sourceTrust,
    sourceTrustLabel: context.sourceTrustLabel,
    riskLevel,
    decision: decisionResult.decision,
    decisionReason: decisionResult.reason,
    report
  };
}
