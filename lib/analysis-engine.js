export function impliedProbability(decimalOdds) {
  if (!decimalOdds || decimalOdds <= 1) return 0;
  return 1 / decimalOdds;
}

export function expectedValue(decimalOdds, modelProbability) {
  if (!decimalOdds || !modelProbability) return 0;
  return decimalOdds * modelProbability - 1;
}

export function calculateEdge(modelProbability, marketProbability) {
  return modelProbability - marketProbability;
}

export function kellyFraction(decimalOdds, modelProbability) {
  const b = decimalOdds - 1;
  const p = modelProbability;
  const q = 1 - p;

  if (b <= 0) return 0;

  const kelly = (b * p - q) / b;
  return Math.max(0, kelly);
}

export function confidenceLabel(edge, volatility = "medium") {
  if (volatility === "high") {
    if (edge >= 0.08) return "Medium";
    if (edge >= 0.04) return "Low-medium";
    return "Low";
  }

  if (edge >= 0.08) return "High";
  if (edge >= 0.05) return "Medium-high";
  if (edge >= 0.03) return "Medium";
  return "Low";
}

export function analyzeBet({
  selection,
  decimalOdds,
  modelProbability,
  volatility = "medium",
  bankroll = 1000
}) {
  const marketProbability = impliedProbability(decimalOdds);
  const edge = calculateEdge(modelProbability, marketProbability);
  const ev = expectedValue(decimalOdds, modelProbability);
  const kelly = kellyFraction(decimalOdds, modelProbability);
  const quarterKelly = kelly * 0.25;
  const suggestedStake = bankroll * quarterKelly;

  return {
    selection,
    decimalOdds,
    modelProbability,
    marketProbability,
    edge,
    ev,
    kelly,
    quarterKelly,
    suggestedStake,
    confidence: confidenceLabel(edge, volatility)
  };
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatMoney(value) {
  return `${value.toFixed(2)}€`;
}
