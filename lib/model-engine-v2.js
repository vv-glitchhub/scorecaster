export function clamp(value, min = 0.01, max = 0.99) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

export function impliedProbability(decimalOdds) {
  const odds = Number(decimalOdds);
  if (!odds || odds <= 1) return 0;
  return 1 / odds;
}

export function removeVig(outcomes = []) {
  const total = outcomes.reduce(
    (sum, item) => sum + impliedProbability(item.odds),
    0
  );

  if (!total) return outcomes;

  return outcomes.map((item) => ({
    ...item,
    fairProbability: impliedProbability(item.odds) / total
  }));
}

export function ratingProbability({
  homeRating = 55,
  awayRating = 55,
  homeAdvantage = 0
}) {
  const diff = Number(homeRating) + Number(homeAdvantage) - Number(awayRating);
  return clamp(1 / (1 + Math.pow(10, -diff / 20)), 0.05, 0.95);
}

export function contextAdjustment({
  form = 0,
  injuries = 0,
  fatigue = 0,
  motivation = 0,
  lineup = 0
}) {
  let adjustment = 0;

  adjustment += Number(form || 0) * 0.015;
  adjustment -= Number(injuries || 0) * 0.025;
  adjustment -= Number(fatigue || 0) * 0.012;
  adjustment += Number(motivation || 0) * 0.01;
  adjustment += Number(lineup || 0) * 0.015;

  return clamp(adjustment, -0.15, 0.15);
}

export function movementAdjustment({ movementSignal }) {
  if (movementSignal === "Steam Move Down") return 0.025;
  if (movementSignal === "Odds Drift Up") return -0.01;
  if (movementSignal === "Stable") return 0;
  return 0;
}

export function ensembleProbability({
  marketProbability,
  ratingProbabilityValue,
  contextScore = 0,
  movementScore = 0,
  learningBoost = 0
}) {
  const marketWeight = 0.45;
  const ratingWeight = 0.35;
  const contextWeight = 0.12;
  const movementWeight = 0.05;
  const learningWeight = 0.03;

  const probability =
    Number(marketProbability || 0) * marketWeight +
    Number(ratingProbabilityValue || 0) * ratingWeight +
    (0.5 + Number(contextScore || 0)) * contextWeight +
    (0.5 + Number(movementScore || 0)) * movementWeight +
    (0.5 + Number(learningBoost || 0)) * learningWeight;

  return clamp(probability, 0.03, 0.97);
}

export function calculateEV({ probability, odds }) {
  return Number(probability || 0) * Number(odds || 0) - 1;
}

export function calculateEdge({ probability, marketProbability }) {
  return Number(probability || 0) - Number(marketProbability || 0);
}

export function confidenceFromModel({ edge, ev, sourceTrust = 0.5 }) {
  const e = Number(edge || 0);
  const expected = Number(ev || 0);
  const trust = Number(sourceTrust || 0.5);

  if (e >= 0.08 && expected >= 0.08 && trust >= 0.7) return "High";
  if (e >= 0.05 && expected >= 0.04) return "Medium-high";
  if (e >= 0.03 && expected > 0) return "Medium";
  if (e > 0) return "Low";
  return "Avoid";
}

export function analyzeSelectionV2({
  selection,
  odds,
  marketProbability,
  homeRating,
  awayRating,
  homeAdvantage = 0,
  context = {},
  movementSignal = "Stable",
  learningBoost = 0,
  sourceTrust = 0.5
}) {
  const ratingProb = ratingProbability({
    homeRating,
    awayRating,
    homeAdvantage
  });

  const contextScore = contextAdjustment(context);
  const movementScore = movementAdjustment({ movementSignal });

  const probability = ensembleProbability({
    marketProbability,
    ratingProbabilityValue: ratingProb,
    contextScore,
    movementScore,
    learningBoost
  });

  const ev = calculateEV({ probability, odds });
  const edge = calculateEdge({ probability, marketProbability });

  return {
    selection,
    odds,
    marketProbability,
    ratingProbability: ratingProb,
    contextScore,
    movementScore,
    learningBoost,
    modelProbability: probability,
    edge,
    ev,
    confidence: confidenceFromModel({
      edge,
      ev,
      sourceTrust
    })
  };
}
