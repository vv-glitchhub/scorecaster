export function generateAgentReport({
  match,
  selection,
  odds,
  marketProbability,
  modelProbability,
  edge,
  ev,
  confidence,
  decision,
  decisionReason,
  contextScore = 0,
  movementScore = "Stable",
  sourceTrust = 0.5,
  news = []
}) {
  return {
    generatedAt: new Date().toISOString(),
    match,
    selection,
    market: {
      odds,
      marketProbability
    },
    model: {
      probability: modelProbability,
      edge,
      ev,
      confidence
    },
    context: {
      contextScore,
      movementScore,
      sourceTrust
    },
    news,
    decision: {
      action: decision,
      reason: decisionReason
    }
  };
}

export function reportToMarkdown(report) {
  return `# ${report.match}

## Decision
${report.decision.action}

${report.decision.reason}

## Selection
${report.selection} @ ${report.market.odds}

## Model
Model Probability: ${((report.model.probability || 0) * 100).toFixed(1)}%
Edge: ${((report.model.edge || 0) * 100).toFixed(2)}%
EV: ${((report.model.ev || 0) * 100).toFixed(2)}%
Confidence: ${report.model.confidence}

## Context
Context Score: ${report.context.contextScore}
Movement: ${report.context.movementScore}
Source Trust: ${report.context.sourceTrust}

## Notes
${
  report.news?.length
    ? report.news.map((item) => `- ${item}`).join("\n")
    : "- No major notes."
}

Generated: ${report.generatedAt}`;
}
