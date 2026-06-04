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
  movementScore = 0,
  sourceTrust = 0.5,
  news = []
}) {
  const report = {
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

  return report;
}

export function reportToMarkdown(report) {
  return `
# ${report.match}

## Decision

${report.decision.action}

${report.decision.reason}

---

## Market

Odds: ${report.market.odds}

Market Probability:
${(report.market.marketProbability * 100).toFixed(1)}%

---

## Model

Model Probability:
${(report.model.probability * 100).toFixed(1)}%

Edge:
${(report.model.edge * 100).toFixed(2)}%

EV:
${(report.model.ev * 100).toFixed(2)}%

Confidence:
${report.model.confidence}

---

## Context

Context Score:
${report.context.contextScore}

Movement Score:
${report.context.movementScore}

Source Trust:
${report.context.sourceTrust}

---

## News

${
  report.news.length
    ? report.news.map((item) => `• ${item}`).join("\n")
    : "No significant news."
}

---

Generated:
${report.generatedAt}
`;
}
