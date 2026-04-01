import { getWinProbability } from "./team-ratings";

export function randomWinner(teamA, teamB, options = {}) {
  const { probA } = getWinProbability(teamA, teamB, options);
  const roll = Math.random();
  return roll < probA ? teamA : teamB;
}

export function simulateSingleTournament(teams, fixtures, options = {}) {
  const wins = {};
  for (const team of teams) {
    wins[team] = 0;
  }

  for (const fixture of fixtures) {
    const winner = randomWinner(fixture.teamA, fixture.teamB, options);
    wins[winner] += 1;
  }

  const sorted = [...teams].sort((a, b) => wins[b] - wins[a]);

  const champion = sorted[0];

  return {
    champion,
    wins,
    standings: sorted.map((team) => ({
      team,
      wins: wins[team],
    })),
  };
}

export function simulateTournamentManyTimes(
  teams,
  fixtures,
  iterations = 10000,
  options = {}
) {
  const championCounts = {};
  const totalWins = {};

  for (const team of teams) {
    championCounts[team] = 0;
    totalWins[team] = 0;
  }

  for (let i = 0; i < iterations; i += 1) {
    const result = simulateSingleTournament(teams, fixtures, options);

    championCounts[result.champion] += 1;

    for (const team of teams) {
      totalWins[team] += result.wins[team] || 0;
    }
  }

  return [...teams]
    .map((team) => ({
      team,
      championProbability: championCounts[team] / iterations,
      averageWins: totalWins[team] / iterations,
      championCount: championCounts[team],
    }))
    .sort((a, b) => b.championProbability - a.championProbability);
}

export function buildRoundRobinFixtures(teams) {
  const fixtures = [];

  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      fixtures.push({
        teamA: teams[i],
        teamB: teams[j],
      });
    }
  }

  return fixtures;
}
