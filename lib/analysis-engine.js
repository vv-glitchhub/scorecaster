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

export function getKellyMultiplier(kellyMode = "quarter") {
  if (kellyMode === "conservative") return 0.1;
  if (kellyMode === "quarter") return 0.25;
  if (kellyMode === "half") return 0.5;
  if (kellyMode === "full") return 1;
  return 0.25;
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
  bankroll = 1000,
  kellyMode = "quarter"
}) {
  const marketProbability = impliedProbability(decimalOdds);
  const edge = calculateEdge(modelProbability, marketProbability);
  const ev = expectedValue(decimalOdds, modelProbability);
  const kelly = kellyFraction(decimalOdds, modelProbability);
  const kellyMultiplier = getKellyMultiplier(kellyMode);
  const adjustedKelly = kelly * kellyMultiplier;
  const suggestedStake = bankroll * adjustedKelly;

  return {
    selection,
    decimalOdds,
    modelProbability,
    marketProbability,
    edge,
    ev,
    kelly,
    kellyMode,
    kellyMultiplier,
    adjustedKelly,
    quarterKelly: kelly * 0.25,
    suggestedStake,
    confidence: confidenceLabel(edge, volatility)
  };
}

export function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)}€`;
}
