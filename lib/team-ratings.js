const DEFAULT_RATING = {
  rating: 1500,
  form: 0,
  attack: 50,
  defense: 50,
  homeAdvantage: 35,
};

export const TEAM_RATINGS = {
  "Colorado Avalanche": {
    rating: 1635,
    form: 0.08,
    attack: 72,
    defense: 61,
    homeAdvantage: 42,
  },
  "Carolina Hurricanes": {
    rating: 1620,
    form: 0.07,
    attack: 68,
    defense: 69,
    homeAdvantage: 38,
  },
  "Vegas Golden Knights": {
    rating: 1585,
    form: 0.03,
    attack: 62,
    defense: 64,
    homeAdvantage: 36,
  },
  "Minnesota Wild": {
    rating: 1535,
    form: 0.01,
    attack: 55,
    defense: 57,
    homeAdvantage: 34,
  },
  "Buffalo Sabres": {
    rating: 1490,
    form: -0.02,
    attack: 54,
    defense: 47,
    homeAdvantage: 32,
  },
  "Montréal Canadiens": {
    rating: 1480,
    form: -0.01,
    attack: 51,
    defense: 48,
    homeAdvantage: 31,
  },
  "Philadelphia Flyers": {
    rating: 1505,
    form: 0,
    attack: 50,
    defense: 54,
    homeAdvantage: 33,
  },
  "Anaheim Ducks": {
    rating: 1430,
    form: -0.06,
    attack: 44,
    defense: 42,
    homeAdvantage: 28,
  },

  "Boston Celtics": {
    rating: 1670,
    form: 0.08,
    attack: 76,
    defense: 71,
    homeAdvantage: 38,
  },
  "Milwaukee Bucks": {
    rating: 1605,
    form: 0.04,
    attack: 72,
    defense: 60,
    homeAdvantage: 36,
  },
  "Denver Nuggets": {
    rating: 1630,
    form: 0.06,
    attack: 74,
    defense: 63,
    homeAdvantage: 40,
  },
  "Los Angeles Lakers": {
    rating: 1560,
    form: 0.02,
    attack: 66,
    defense: 55,
    homeAdvantage: 35,
  },

  Arsenal: {
    rating: 1650,
    form: 0.07,
    attack: 73,
    defense: 69,
    homeAdvantage: 40,
  },
  Chelsea: {
    rating: 1570,
    form: 0.02,
    attack: 63,
    defense: 58,
    homeAdvantage: 35,
  },
  Liverpool: {
    rating: 1660,
    form: 0.08,
    attack: 76,
    defense: 64,
    homeAdvantage: 42,
  },
  "Manchester City": {
    rating: 1685,
    form: 0.06,
    attack: 78,
    defense: 70,
    homeAdvantage: 41,
  },
};

export function getTeamRating(teamName) {
  return TEAM_RATINGS[teamName] || DEFAULT_RATING;
}

export function getMatchRatingContext(match) {
  const home = getTeamRating(match?.home_team);
  const away = getTeamRating(match?.away_team);

  return {
    home,
    away,
    ratingDiff: home.rating + home.homeAdvantage - away.rating,
    formDiff: home.form - away.form,
    attackDefenseDiff: (home.attack - away.defense) - (away.attack - home.defense),
  };
}
