export function calculatePolymarketSignal({
  modelProbability = 0,
  polymarketProbability = null
}) {
  if (
    polymarketProbability === null ||
    polymarketProbability === undefined
  ) {
    return {
      score: 0,
      difference: 0,
      note: "No Polymarket data"
    };
  }

  const difference =
    Number(modelProbability) -
    Number(polymarketProbability);

  let score = 0;

  if (difference > 0.1) score = 0.03;
  else if (difference > 0.05) score = 0.015;
  else if (difference < -0.1) score = -0.03;
  else if (difference < -0.05) score = -0.015;

  return {
    score,
    difference,
    note:
      difference > 0
        ? "Model higher than market"
        : "Market higher than model"
  };
}
