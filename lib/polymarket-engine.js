export function calculatePolymarketDifference({
  modelProbability = 0,
  polymarketProbability = null
}) {
  if (polymarketProbability === null || polymarketProbability === undefined) {
    return {
      available: false,
      difference: 0,
      signal: "No Polymarket data",
      note: "Polymarket probability is not available for this market."
    };
  }

  const difference =
    Number(modelProbability || 0) - Number(polymarketProbability || 0);

  if (difference >= 0.08) {
    return {
      available: true,
      difference,
      signal: "Model Above Polymarket",
      note: "Scorecaster model is meaningfully higher than Polymarket."
    };
  }

  if (difference <= -0.08) {
    return {
      available: true,
      difference,
      signal: "Model Below Polymarket",
      note: "Polymarket is more optimistic than Scorecaster model."
    };
  }

  return {
    available: true,
    difference,
    signal: "Aligned",
    note: "Model and Polymarket are broadly aligned."
  };
}

export function estimatePolymarketProbabilityFromOdds(odds) {
  const numericOdds = Number(odds || 0);

  if (!numericOdds || numericOdds <= 1) return null;

  return 1 / numericOdds;
}
