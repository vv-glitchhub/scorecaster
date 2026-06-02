export function simulateMatch({
  homeTeam,
  awayTeam,
  homeRating = 55,
  awayRating = 50,
  homeAdvantage = 3,
  simulations = 10000
}) {
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalHomeScore = 0;
  let totalAwayScore = 0;

  const homeStrength = Number(homeRating) + Number(homeAdvantage);
  const awayStrength = Number(awayRating);

  for (let i = 0; i < simulations; i++) {
    const homeScore = generateScore(homeStrength);
    const awayScore = generateScore(awayStrength);

    totalHomeScore += homeScore;
    totalAwayScore += awayScore;

    if (homeScore > awayScore) homeWins++;
    else if (awayScore > homeScore) awayWins++;
    else draws++;
  }

  return {
    homeTeam,
    awayTeam,
    simulations,
    homeWinProbability: homeWins / simulations,
    awayWinProbability: awayWins / simulations,
    drawProbability: draws / simulations,
    averageHomeScore: totalHomeScore / simulations,
    averageAwayScore: totalAwayScore / simulations,
    projectedTotal:
      totalHomeScore / simulations + totalAwayScore / simulations,
    upsetRisk:
      homeStrength >= awayStrength
        ? awayWins / simulations
        : homeWins / simulations
  };
}

function generateScore(strength) {
  const base = strength / 20;
  const randomNoise = Math.random() * 2.4;
  return Math.max(0, Math.round(base + randomNoise - 1));
}

export function compareToMarket(modelProbability, decimalOdds) {
  const marketProbability = decimalOdds > 1 ? 1 / decimalOdds : 0;
  const edge = modelProbability - marketProbability;

  return {
    modelProbability,
    marketProbability,
    edge
  };
}

export function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}
