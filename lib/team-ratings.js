export const DEFAULT_TEAM_RATINGS = {
  Canada: 92,
  Sweden: 89,
  Finland: 87,
  USA: 86,
  Czechia: 84,
  Switzerland: 82,
  Germany: 79,
  Slovakia: 77,
  Latvia: 75,
  Denmark: 73,
  Norway: 71,
  Austria: 69,
  France: 68,
  Slovenia: 66,
  Kazakhstan: 65,
  Hungary: 63,
};

export function getTeamRating(teamName, customRatings = {}) {
  if (customRatings[teamName] != null) return customRatings[teamName];
  if (DEFAULT_TEAM_RATINGS[teamName] != null) return DEFAULT_TEAM_RATINGS[teamName];
  return 70;
}

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 10));
}

export function getWinProbability(teamA, teamB, options = {}) {
  const {
    customRatings = {},
    homeAdvantage = 0,
    fatigue = {},
    injuries = {},
  } = options;

  let ratingA = getTeamRating(teamA, customRatings);
  let ratingB = getTeamRating(teamB, customRatings);

  ratingA += homeAdvantage;
  ratingA -= fatigue[teamA] || 0;
  ratingB -= fatigue[teamB] || 0;

  ratingA -= injuries[teamA] || 0;
  ratingB -= injuries[teamB] || 0;

  const probA = expectedScore(ratingA, ratingB);
  const probB = 1 - probA;

  return {
    teamA,
    teamB,
    ratingA,
    ratingB,
    probA,
    probB,
  };
}
