import { DEFAULT_TEAM_DATA, getOverallRating, getTeamProfile } from "./team-ratings";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function poissonSample(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;

  do {
    k += 1;
    p *= Math.random();
  } while (p > L);

  return k - 1;
}

function buildExpectedGoals(teamA, teamB, customData = {}) {
  const a = getTeamProfile(teamA, customData);
  const b = getTeamProfile(teamB, customData);

  const ratingA = getOverallRating(teamA, customData);
  const ratingB = getOverallRating(teamB, customData);

  const attackVsDefenseA = (a.attack - b.defense) / 25;
  const attackVsDefenseB = (b.attack - a.defense) / 25;

  const goalieEffectA = (70 - b.goalie) / 35;
  const goalieEffectB = (70 - a.goalie) / 35;

  const ratingEffectA = (ratingA - ratingB) / 40;
  const ratingEffectB = (ratingB - ratingA) / 40;

  const lambdaA = clamp(2.5 + attackVsDefenseA + goalieEffectA + ratingEffectA, 1.2, 5.4);
  const lambdaB = clamp(2.5 + attackVsDefenseB + goalieEffectB + ratingEffectB, 1.2, 5.4);

  return { lambdaA, lambdaB };
}

export function simulateMatch(teamA, teamB, customData = {}, allowOvertime = true) {
  const { lambdaA, lambdaB } = buildExpectedGoals(teamA, teamB, customData);

  let goalsA = poissonSample(lambdaA);
  let goalsB = poissonSample(lambdaB);

  let winner = null;
  let overtime = false;

  if (goalsA > goalsB) {
    winner = teamA;
  } else if (goalsB > goalsA) {
    winner = teamB;
  } else if (allowOvertime) {
    overtime = true;
    winner = Math.random() < 0.5 ? teamA : teamB;
  } else {
    winner = goalsA >= goalsB ? teamA : teamB;
  }

  return {
    teamA,
    teamB,
    goalsA,
    goalsB,
    winner,
    overtime,
  };
}

function initStandings(teams) {
  const map = {};
  for (const team of teams) {
    map[team] = {
      team,
      points: 0,
      wins: 0,
      otWins: 0,
      losses: 0,
      otLosses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
    };
  }
  return map;
}

function applyGroupMatch(standings, result) {
  const a = standings[result.teamA];
  const b = standings[result.teamB];

  a.goalsFor += result.goalsA;
  a.goalsAgainst += result.goalsB;
  b.goalsFor += result.goalsB;
  b.goalsAgainst += result.goalsA;

  a.goalDiff = a.goalsFor - a.goalsAgainst;
  b.goalDiff = b.goalsFor - b.goalsAgainst;

  if (!result.overtime) {
    if (result.winner === result.teamA) {
      a.points += 3;
      a.wins += 1;
      b.losses += 1;
    } else {
      b.points += 3;
      b.wins += 1;
      a.losses += 1;
    }
    return;
  }

  if (result.winner === result.teamA) {
    a.points += 2;
    a.otWins += 1;
    b.points += 1;
    b.otLosses += 1;
  } else {
    b.points += 2;
    b.otWins += 1;
    a.points += 1;
    a.otLosses += 1;
  }
}

function sortStandings(table, customData = {}) {
  return [...Object.values(table)].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.goalDiff !== x.goalDiff) return y.goalDiff - x.goalDiff;
    if (y.goalsFor !== x.goalsFor) return y.goalsFor - x.goalsFor;
    return getOverallRating(y.team, customData) - getOverallRating(x.team, customData);
  });
}

export function buildRoundRobinFixtures(teams) {
  const fixtures = [];
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      fixtures.push({ teamA: teams[i], teamB: teams[j] });
    }
  }
  return fixtures;
}

export function simulateGroupStage(groups, customData = {}) {
  const groupResults = {};

  for (const [groupName, teams] of Object.entries(groups)) {
    const standings = initStandings(teams);
    const fixtures = buildRoundRobinFixtures(teams);

    for (const fixture of fixtures) {
      const result = simulateMatch(fixture.teamA, fixture.teamB, customData, true);
      applyGroupMatch(standings, result);
    }

    groupResults[groupName] = sortStandings(standings, customData);
  }

  return groupResults;
}

export function simulateWorldChampionship(customData = DEFAULT_TEAM_DATA) {
  const groups = {
    A: ["Canada", "Sweden", "Germany", "Slovakia", "Latvia", "France", "Kazakhstan", "Hungary"],
    B: ["Finland", "USA", "Czechia", "Switzerland", "Denmark", "Norway", "Austria", "Slovenia"],
  };

  const groupTables = simulateGroupStage(groups, customData);

  const A = groupTables.A;
  const B = groupTables.B;

  const quarterFinalists = [
    A[0].team, A[1].team, A[2].team, A[3].team,
    B[0].team, B[1].team, B[2].team, B[3].team,
  ];

  const semifinalists = [];
  const finalists = [];
  let champion = null;
  let bronzeWinner = null;

  const qf1 = simulateMatch(A[0].team, B[3].team, customData, true);
  const qf2 = simulateMatch(A[1].team, B[2].team, customData, true);
  const qf3 = simulateMatch(B[0].team, A[3].team, customData, true);
  const qf4 = simulateMatch(B[1].team, A[2].team, customData, true);

  semifinalists.push(qf1.winner, qf2.winner, qf3.winner, qf4.winner);

  const sf1 = simulateMatch(qf1.winner, qf2.winner, customData, true);
  const sf2 = simulateMatch(qf3.winner, qf4.winner, customData, true);

  finalists.push(sf1.winner, sf2.winner);

  const bronzeTeams = [
    sf1.winner === qf1.winner || sf1.winner === qf2.winner
      ? (sf1.winner === qf1.winner ? qf2.winner : qf1.winner)
      : null,
    sf2.winner === qf3.winner || sf2.winner === qf4.winner
      ? (sf2.winner === qf3.winner ? qf4.winner : qf3.winner)
      : null,
  ].filter(Boolean);

  if (bronzeTeams.length === 2) {
    bronzeWinner = simulateMatch(bronzeTeams[0], bronzeTeams[1], customData, true).winner;
  }

  champion = simulateMatch(sf1.winner, sf2.winner, customData, true).winner;

  return {
    groups: groupTables,
    quarterFinalists,
    semifinalists,
    finalists,
    champion,
    bronzeWinner,
  };
}

export function simulateWorldChampionshipManyTimes(iterations = 5000, customData = DEFAULT_TEAM_DATA) {
  const allTeams = Object.keys(customData);

  const championCounts = {};
  const finalistCounts = {};
  const semifinalCounts = {};
  const quarterCounts = {};

  for (const team of allTeams) {
    championCounts[team] = 0;
    finalistCounts[team] = 0;
    semifinalCounts[team] = 0;
    quarterCounts[team] = 0;
  }

  for (let i = 0; i < iterations; i += 1) {
    const result = simulateWorldChampionship(customData);

    for (const team of result.quarterFinalists) {
      quarterCounts[team] += 1;
    }
    for (const team of result.semifinalists) {
      semifinalCounts[team] += 1;
    }
    for (const team of result.finalists) {
      finalistCounts[team] += 1;
    }
    championCounts[result.champion] += 1;
  }

  return allTeams
    .map((team) => ({
      team,
      rating: getOverallRating(team, customData),
      quarterProbability: quarterCounts[team] / iterations,
      semifinalProbability: semifinalCounts[team] / iterations,
      finalProbability: finalistCounts[team] / iterations,
      championProbability: championCounts[team] / iterations,
      championCount: championCounts[team],
    }))
    .sort((a, b) => b.championProbability - a.championProbability);
}
