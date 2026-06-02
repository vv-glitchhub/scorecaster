export function impliedProbability(decimalOdds) {
  const odds = Number(decimalOdds);
  if (!odds || odds <= 1) return 0;
  return 1 / odds;
}

export function expectedValue(decimalOdds, modelProbability) {
  const odds = Number(decimalOdds);
  const probability = Number(modelProbability);
  if (!odds || !probability) return 0;
  return odds * probability - 1;
}

export function calculateEdge(modelProbability, marketProbability) {
  return Number(modelProbability || 0) - Number(marketProbability || 0);
}

export function kellyFraction(decimalOdds, modelProbability) {
  const odds = Number(decimalOdds);
  const p = Number(modelProbability);
  const b = odds - 1;
  const q = 1 - p;

  if (!odds || odds <= 1 || !p || b <= 0) return 0;

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
  const numericEdge = Number(edge || 0);

  if (volatility === "high") {
    if (numericEdge >= 0.08) return "Medium";
    if (numericEdge >= 0.04) return "Low-medium";
    return "Low";
  }

  if (numericEdge >= 0.08) return "High";
  if (numericEdge >= 0.05) return "Medium-high";
  if (numericEdge >= 0.03) return "Medium";
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
  const suggestedStake = Number(bankroll || 0) * adjustedKelly;

  return {
    selection,
    decimalOdds: Number(decimalOdds || 0),
    modelProbability: Number(modelProbability || 0),
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
