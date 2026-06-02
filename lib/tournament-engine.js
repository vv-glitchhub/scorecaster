import { simulateMatch } from "./simulator-engine";

export function simulateTournament({ teams, simulations = 1000 }) {
  const championCounts = {};
  const finalCounts = {};
  const semifinalCounts = {};

  for (let i = 0; i < simulations; i++) {
    const result = runSingleTournament(teams);

    championCounts[result.champion] =
      (championCounts[result.champion] || 0) + 1;

    result.finalists.forEach((team) => {
      finalCounts[team] = (finalCounts[team] || 0) + 1;
    });

    result.semifinalists.forEach((team) => {
      semifinalCounts[team] = (semifinalCounts[team] || 0) + 1;
    });
  }

  return teams
    .map((team) => ({
      team: team.name,
      rating: team.rating,
      championProbability: (championCounts[team.name] || 0) / simulations,
      finalProbability: (finalCounts[team.name] || 0) / simulations,
      semifinalProbability: (semifinalCounts[team.name] || 0) / simulations
    }))
    .sort((a, b) => b.championProbability - a.championProbability);
}

export function runSingleTournament(teams) {
  const quarterfinalists = [...teams];
  const semifinalists = playRound(quarterfinalists);
  const finalists = playRound(semifinalists);
  const championRound = playRound(finalists);

  return {
    quarterfinalists: quarterfinalists.map((team) => team.name),
    semifinalists: semifinalists.map((team) => team.name),
    finalists: finalists.map((team) => team.name),
    champion: championRound[0].name
  };
}

function playRound(teams) {
  const winners = [];

  for (let i = 0; i < teams.length; i += 2) {
    const home = teams[i];
    const away = teams[i + 1];

    const result = simulateMatch({
      homeTeam: home.name,
      awayTeam: away.name,
      homeRating: home.rating,
      awayRating: away.rating,
      homeAdvantage: 0,
      simulations: 1
    });

    const winner =
      result.homeWinProbability >= result.awayWinProbability ? home : away;

    winners.push(winner);
  }

  return winners;
}
