import {
  DEFAULT_TEAM_DATA,
  getAllTeamRatings,
  getOverallRating,
  getTeamProfile,
} from "./team-ratings";

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getMatchupWinProbability(teamA, teamB, options = {}) {
  const homeAdvantage = Number(options.homeAdvantage ?? 0);
  const a = getOverallRating(teamA) + homeAdvantage;
  const b = getOverallRating(teamB);
  const diff = a - b;

  // Logistic-like transform, smooth and stable
  const probA = 1 / (1 + Math.exp(-diff / 8.5));

  return clamp(probA, 0.03, 0.97);
}

export function simulateSingleGame(teamA, teamB, options = {}) {
  const probA = getMatchupWinProbability(teamA, teamB, options);
  const winner = Math.random() < probA ? teamA : teamB;

  return {
    winner,
    loser: winner.team_name === teamA.team_name ? teamB : teamA,
    probabilityA: Number(probA.toFixed(4)),
  };
}

function createStatsEntry(team) {
  return {
    team_name: team.team_name,
    overall_rating: getOverallRating(team),
    championships: 0,
    finals: 0,
    top4: 0,
    appearances: 0,
  };
}

function ensureStats(stats, team) {
  if (!stats.has(team.team_name)) {
    stats.set(team.team_name, createStatsEntry(team));
  }
  return stats.get(team.team_name);
}

function simulateBracketRound(teams, stats, label) {
  const shuffled = shuffle(teams);
  const nextRound = [];
  const games = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    const teamA = shuffled[i];
    const teamB = shuffled[i + 1];

    if (!teamB) {
      nextRound.push(teamA);
      continue;
    }

    const result = simulateSingleGame(teamA, teamB);

    if (label === "quarterfinal") {
      ensureStats(stats, result.winner).top4 += 1;
    }

    if (label === "semifinal") {
      ensureStats(stats, result.winner).finals += 1;
    }

    nextRound.push(result.winner);

    games.push({
      round: label,
      teamA: teamA.team_name,
      teamB: teamB.team_name,
      winner: result.winner.team_name,
      probabilityA: result.probabilityA,
    });
  }

  return { nextRound, games };
}

export function simulateWorldChampionshipOnce(teamsInput = []) {
  const teams =
    Array.isArray(teamsInput) && teamsInput.length > 0
      ? teamsInput
      : getAllTeamRatings();

  const tournamentTeams = teams.map((team) =>
    getTeamProfile(team.team_name, teams)
  );

  const stats = new Map();
  tournamentTeams.forEach((team) => {
    ensureStats(stats, team).appearances += 1;
  });

  const quarter = simulateBracketRound(tournamentTeams, stats, "quarterfinal");
  const semi = simulateBracketRound(quarter.nextRound, stats, "semifinal");
  const final = simulateBracketRound(semi.nextRound, stats, "final");

  const champion = final.nextRound[0] ?? null;
  if (champion) {
    ensureStats(stats, champion).championships += 1;
  }

  return {
    champion: champion?.team_name ?? null,
    rounds: {
      quarterfinals: quarter.games,
      semifinals: semi.games,
      finals: final.games,
    },
    stats,
  };
}

export function simulateWorldChampionshipManyTimes({
  teamRatings = [],
  iterations = 5000,
} = {}) {
  const teams =
    Array.isArray(teamRatings) && teamRatings.length > 0
      ? teamRatings.map((team) => getTeamProfile(team.team_name, teamRatings))
      : getAllTeamRatings();

  const stats = new Map();
  teams.forEach((team) => {
    stats.set(team.team_name, createStatsEntry(team));
  });

  let sampleRounds = null;

  for (let i = 0; i < iterations; i += 1) {
    const result = simulateWorldChampionshipOnce(teams);

    if (i === 0) {
      sampleRounds = result.rounds;
    }

    for (const [teamName, roundStats] of result.stats.entries()) {
      const target = stats.get(teamName) ?? createStatsEntry({ team_name: teamName });
      target.appearances += 1;
      target.top4 += roundStats.top4;
      target.finals += roundStats.finals;
      target.championships += roundStats.championships;
      stats.set(teamName, target);
    }
  }

  const table = Array.from(stats.values())
    .map((row) => ({
      ...row,
      championship_pct: Number(((row.championships / iterations) * 100).toFixed(2)),
      finals_pct: Number(((row.finals / iterations) * 100).toFixed(2)),
      top4_pct: Number(((row.top4 / iterations) * 100).toFixed(2)),
    }))
    .sort((a, b) => {
      if (b.championship_pct !== a.championship_pct) {
        return b.championship_pct - a.championship_pct;
      }
      return b.overall_rating - a.overall_rating;
    });

  const powerRanking = teams
    .map((team) => ({
      team_name: team.team_name,
      overall_rating: getOverallRating(team),
      attack_rating: team.attack_rating ?? DEFAULT_TEAM_DATA.attack_rating,
      defense_rating: team.defense_rating ?? DEFAULT_TEAM_DATA.defense_rating,
      form_last_5: team.form_last_5 ?? DEFAULT_TEAM_DATA.form_last_5,
      injuries_count: team.injuries_count ?? DEFAULT_TEAM_DATA.injuries_count,
      lineup_stability: team.lineup_stability ?? DEFAULT_TEAM_DATA.lineup_stability,
    }))
    .sort((a, b) => b.overall_rating - a.overall_rating);

  return {
    iterations,
    powerRanking,
    championshipTable: table,
    top5: table.slice(0, 5),
    sampleRounds,
  };
}
