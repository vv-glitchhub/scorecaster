function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeProbabilities({ home = 0.45, draw = 0.23, away = 0.32 }) {
  const h = Math.max(0, Number(home) || 0);
  const d = Math.max(0, Number(draw) || 0);
  const a = Math.max(0, Number(away) || 0);
  const total = h + d + a;

  if (!total) {
    return { home: 0.45, draw: 0.23, away: 0.32 };
  }

  return {
    home: h / total,
    draw: d / total,
    away: a / total,
  };
}

export function probabilitiesFromOdds(bestOdds = {}) {
  const homeRaw = bestOdds.home ? 1 / Number(bestOdds.home) : 0;
  const drawRaw = bestOdds.draw ? 1 / Number(bestOdds.draw) : 0;
  const awayRaw = bestOdds.away ? 1 / Number(bestOdds.away) : 0;

  return normalizeProbabilities({
    home: homeRaw || 0.45,
    draw: drawRaw || 0.23,
    away: awayRaw || 0.32,
  });
}

export function simulateSingleMatch({ homeTeam, awayTeam, probabilities, iterations = 10000 }) {
  const probs = normalizeProbabilities(probabilities);
  const n = clamp(Number(iterations) || 10000, 1000, 100000);

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  for (let i = 0; i < n; i += 1) {
    const r = Math.random();

    if (r < probs.home) homeWins += 1;
    else if (r < probs.home + probs.draw) draws += 1;
    else awayWins += 1;
  }

  return {
    homeTeam,
    awayTeam,
    iterations: n,
    home: homeWins / n,
    draw: draws / n,
    away: awayWins / n,
  };
}

function chooseWinner(match) {
  const probs = probabilitiesFromOdds(match.bestOdds);
  const r = Math.random();

  if (r < probs.home) return match.home_team;
  if (r < probs.home + probs.draw) {
    return Math.random() > 0.5 ? match.home_team : match.away_team;
  }

  return match.away_team;
}

export function simulateKnockoutTournament({ matches = [], iterations = 10000 }) {
  const usable = matches.filter((m) => m.home_team && m.away_team).slice(0, 16);
  const n = clamp(Number(iterations) || 10000, 1000, 50000);
  const titleCounts = {};

  if (usable.length < 2) {
    return {
      iterations: n,
      teams: [],
      message: "Tarvitaan vähintään kaksi ottelua turnaussimulaatioon.",
    };
  }

  for (let i = 0; i < n; i += 1) {
    let winners = usable.map(chooseWinner);

    while (winners.length > 1) {
      const nextRound = [];

      for (let j = 0; j < winners.length; j += 2) {
        const a = winners[j];
        const b = winners[j + 1];

        if (!b) {
          nextRound.push(a);
          continue;
        }

        nextRound.push(Math.random() > 0.5 ? a : b);
      }

      winners = nextRound;
    }

    const champion = winners[0];
    titleCounts[champion] = (titleCounts[champion] || 0) + 1;
  }

  return {
    iterations: n,
    teams: Object.entries(titleCounts)
      .map(([team, wins]) => ({
        team,
        titleProbability: wins / n,
      }))
      .sort((a, b) => b.titleProbability - a.titleProbability),
  };
}
