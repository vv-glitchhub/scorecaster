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
      downgradeOnly: true,
      note: "No Polymarket data"
    };
  }

  const difference =
    Number(modelProbability) -
    Number(polymarketProbability);

  let score = 0;

  if (difference > 0.15) score = -0.03;
  else if (difference > 0.08) score = -0.02;
  else if (difference > 0.05) score = -0.01;

  return {
    score,
    difference,
    downgradeOnly: true,
    probabilityAdjusted: false,
    note:
      difference > 0.05
        ? "Polymarket is materially below the model; verify downside risk"
        : "Polymarket does not create an upgrade signal"
  };
}
