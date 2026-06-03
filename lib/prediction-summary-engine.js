export function summarizePredictionSlip(predictions = []) {
  const strong = predictions.filter((game) => game.confidence === "Strong");
  const medium = predictions.filter((game) => game.confidence === "Medium");
  const low = predictions.filter((game) => game.confidence === "Low");

  const doubles = predictions.filter((game) => game.safePick?.length === 2);

  let riskLevel = "Low";

  if (low.length >= 3 || doubles.length >= 3) {
    riskLevel = "High";
  } else if (low.length >= 1 || doubles.length >= 1) {
    riskLevel = "Medium";
  }

  const strongestPick = [...predictions].sort((a, b) => {
    const maxA = Math.max(
      a.homeWinProbability,
      a.drawProbability,
      a.awayWinProbability
    );

    const maxB = Math.max(
      b.homeWinProbability,
      b.drawProbability,
      b.awayWinProbability
    );

    return maxB - maxA;
  })[0];

  const weakestPick = [...predictions].sort((a, b) => {
    const maxA = Math.max(
      a.homeWinProbability,
      a.drawProbability,
      a.awayWinProbability
    );

    const maxB = Math.max(
      b.homeWinProbability,
      b.drawProbability,
      b.awayWinProbability
    );

    return maxA - maxB;
  })[0];

  return {
    totalGames: predictions.length,
    strongCount: strong.length,
    mediumCount: medium.length,
    lowCount: low.length,
    doubleCount: doubles.length,
    riskLevel,
    strongestPick,
    weakestPick
  };
}
