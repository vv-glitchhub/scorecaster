export function calculateImpliedProbability(odds) {
  if (!odds || odds <= 1) return null;
  return 1 / odds;
}

export function calculateFairOdds(probability) {
  if (!probability || probability <= 0) return null;
  return 1 / probability;
}

export function calculateExpectedValue(probability, odds) {
  if (!probability || !odds) return null;
  return probability * odds - 1;
}

export function calculateEdge(modelProbability, impliedProbability) {
  if (!modelProbability || !impliedProbability) return null;
  return modelProbability - impliedProbability;
}

export function buildValueBetMetrics({
  odds,
  modelProbability,
  bookmaker = null,
  side,
  team,
}) {
  const impliedProbability = calculateImpliedProbability(odds);
  const fairOdds = calculateFairOdds(modelProbability);
  const expectedValue = calculateExpectedValue(modelProbability, odds);
  const edge = calculateEdge(modelProbability, impliedProbability);

  return {
    side,
    team,
    odds,
    bookmaker,
    modelProbability: modelProbability
      ? Number((modelProbability * 100).toFixed(2))
      : null,
    impliedProbability: impliedProbability
      ? Number((impliedProbability * 100).toFixed(2))
      : null,
    fairOdds: fairOdds ? Number(fairOdds.toFixed(2)) : null,
    expectedValue: expectedValue
      ? Number((expectedValue * 100).toFixed(2))
      : null,
    edge: edge ? Number((edge * 100).toFixed(2)) : null,
  };
}
