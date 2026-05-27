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
  let totalHomeScore = 0;
  let totalAwayScore = 0;
  let overtimeGames = 0;

  const homeStrength = homeRating + homeAdvantage;
  const awayStrength = awayRating;

  for (let i = 0; i < simulations; i++) {
    const homeScore = generateScore(homeStrength);
    const awayScore = generateScore(awayStrength);

    totalHomeScore += homeScore;
    totalAwayScore += awayScore;

    if (homeScore === awayScore) {
      overtimeGames++;
      if (Math.random() > 0.5) homeWins++;
      else awayWins++;
    } else if (homeScore > awayScore) {
      homeWins++;
    } else {
      awayWins++;
    }
  }

  return {
    homeTeam,
    awayTeam,
    simulations,
    homeWinProbability: homeWins / simulations,
    awayWinProbability: awayWins / simulations,
    averageHomeScore: totalHomeScore / simulations,
    averageAwayScore: totalAwayScore / simulations,
    overtimeProbability: overtimeGames / simulations,
    upsetRisk:
      homeStrength > awayStrength
        ? awayWins / simulations
        : homeWins / simulations
  };
}

function generateScore(strength) {
  const base = strength / 20;
  const randomness = Math.random() * 2.2;
  return Math.max(0, Math.round(base + randomness - 1));
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatNumber(value) {
  return value.toFixed(2);
}
