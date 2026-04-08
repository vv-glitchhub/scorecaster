const DEFAULT_TEAM_PROFILE = {
  team_name: "",
  attack_rating: 50,
  defense_rating: 50,
  form_last_5: 50,
  rest_days: 3,
  travel_km: 0,
  injuries_count: 0,
  lineup_stability: 70,
  home_advantage: 4,
};

export const DEFAULT_TEAM_DATA = DEFAULT_TEAM_PROFILE;

export const RATING_WEIGHTS = {
  attack: 0.26,
  defense: 0.24,
  form: 0.16,
  rest: 0.08,
  injuries: 0.12,
  lineup: 0.1,
  homeAdvantage: 0.04,
};

const DEMO_TEAM_RATINGS = {
  Canada: {
    team_name: "Canada",
    attack_rating: 92,
    defense_rating: 90,
    form_last_5: 88,
    rest_days: 3,
    travel_km: 140,
    injuries_count: 1,
    lineup_stability: 89,
    home_advantage: 4,
  },
  Sweden: {
    team_name: "Sweden",
    attack_rating: 87,
    defense_rating: 89,
    form_last_5: 85,
    rest_days: 3,
    travel_km: 320,
    injuries_count: 1,
    lineup_stability: 86,
    home_advantage: 4,
  },
  Finland: {
    team_name: "Finland",
    attack_rating: 84,
    defense_rating: 88,
    form_last_5: 82,
    rest_days: 3,
    travel_km: 260,
    injuries_count: 1,
    lineup_stability: 84,
    home_advantage: 4,
  },
  USA: {
    team_name: "USA",
    attack_rating: 89,
    defense_rating: 84,
    form_last_5: 84,
    rest_days: 2,
    travel_km: 850,
    injuries_count: 2,
    lineup_stability: 80,
    home_advantage: 4,
  },
  Czechia: {
    team_name: "Czechia",
    attack_rating: 82,
    defense_rating: 83,
    form_last_5: 80,
    rest_days: 3,
    travel_km: 180,
    injuries_count: 1,
    lineup_stability: 82,
    home_advantage: 4,
  },
  Switzerland: {
    team_name: "Switzerland",
    attack_rating: 79,
    defense_rating: 81,
    form_last_5: 78,
    rest_days: 3,
    travel_km: 170,
    injuries_count: 1,
    lineup_stability: 80,
    home_advantage: 4,
  },
  Germany: {
    team_name: "Germany",
    attack_rating: 76,
    defense_rating: 78,
    form_last_5: 76,
    rest_days: 3,
    travel_km: 140,
    injuries_count: 2,
    lineup_stability: 78,
    home_advantage: 4,
  },
  Slovakia: {
    team_name: "Slovakia",
    attack_rating: 74,
    defense_rating: 75,
    form_last_5: 73,
    rest_days: 2,
    travel_km: 260,
    injuries_count: 2,
    lineup_stability: 75,
    home_advantage: 4,
  },
  Latvia: {
    team_name: "Latvia",
    attack_rating: 71,
    defense_rating: 73,
    form_last_5: 72,
    rest_days: 2,
    travel_km: 220,
    injuries_count: 2,
    lineup_stability: 74,
    home_advantage: 4,
  },
  Denmark: {
    team_name: "Denmark",
    attack_rating: 68,
    defense_rating: 69,
    form_last_5: 67,
    rest_days: 2,
    travel_km: 250,
    injuries_count: 2,
    lineup_stability: 71,
    home_advantage: 4,
  },
  Norway: {
    team_name: "Norway",
    attack_rating: 64,
    defense_rating: 66,
    form_last_5: 63,
    rest_days: 2,
    travel_km: 280,
    injuries_count: 2,
    lineup_stability: 68,
    home_advantage: 4,
  },
  Austria: {
    team_name: "Austria",
    attack_rating: 63,
    defense_rating: 64,
    form_last_5: 62,
    rest_days: 2,
    travel_km: 200,
    injuries_count: 2,
    lineup_stability: 67,
    home_advantage: 4,
  },
  Slovenia: {
    team_name: "Slovenia",
    attack_rating: 58,
    defense_rating: 60,
    form_last_5: 57,
    rest_days: 2,
    travel_km: 240,
    injuries_count: 3,
    lineup_stability: 64,
    home_advantage: 4,
  },
  France: {
    team_name: "France",
    attack_rating: 60,
    defense_rating: 61,
    form_last_5: 59,
    rest_days: 2,
    travel_km: 300,
    injuries_count: 3,
    lineup_stability: 66,
    home_advantage: 4,
  },
  Kazakhstan: {
    team_name: "Kazakhstan",
    attack_rating: 57,
    defense_rating: 58,
    form_last_5: 56,
    rest_days: 2,
    travel_km: 900,
    injuries_count: 3,
    lineup_stability: 63,
    home_advantage: 4,
  },
  Hungary: {
    team_name: "Hungary",
    attack_rating: 55,
    defense_rating: 56,
    form_last_5: 55,
    rest_days: 2,
    travel_km: 240,
    injuries_count: 3,
    lineup_stability: 62,
    home_advantage: 4,
  },
};

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

export function getDefaultTeamProfile(teamName = "") {
  return {
    ...DEFAULT_TEAM_PROFILE,
    team_name: teamName,
  };
}

export function getTeamProfile(teamName, teamRatings = null) {
  if (!teamName) return getDefaultTeamProfile("");

  if (Array.isArray(teamRatings) && teamRatings.length > 0) {
    const found = teamRatings.find((row) => row?.team_name === teamName);
    if (found) {
      return {
        team_name: teamName,
        attack_rating: clamp(found.attack_rating ?? 50, 1, 100),
        defense_rating: clamp(found.defense_rating ?? 50, 1, 100),
        form_last_5: clamp(found.form_last_5 ?? 50, 1, 100),
        rest_days: clamp(found.rest_days ?? 3, 0, 10),
        travel_km: clamp(found.travel_km ?? 0, 0, 10000),
        injuries_count: clamp(found.injuries_count ?? 0, 0, 20),
        lineup_stability: clamp(found.lineup_stability ?? 70, 1, 100),
        home_advantage: clamp(found.home_advantage ?? 4, 0, 15),
      };
    }
  }

  if (DEMO_TEAM_RATINGS[teamName]) {
    return { ...DEMO_TEAM_RATINGS[teamName] };
  }

  return getDefaultTeamProfile(teamName);
}

export function getAllTeamRatings() {
  return Object.values(DEMO_TEAM_RATINGS).map((team) => ({ ...team }));
}

export function getOverallRating(team) {
  if (!team) return 50;

  const injuryScore = Math.max(0, 100 - Number(team.injuries_count ?? 0) * 8);
  const restScore = Math.min(100, Number(team.rest_days ?? 0) * 20);
  const travelPenaltyScore = Math.max(
    0,
    100 - Math.min(100, Number(team.travel_km ?? 0) / 12)
  );

  const score =
    Number(team.attack_rating ?? 50) * RATING_WEIGHTS.attack +
    Number(team.defense_rating ?? 50) * RATING_WEIGHTS.defense +
    Number(team.form_last_5 ?? 50) * RATING_WEIGHTS.form +
    restScore * RATING_WEIGHTS.rest +
    injuryScore * RATING_WEIGHTS.injuries +
    Number(team.lineup_stability ?? 70) * RATING_WEIGHTS.lineup +
    Number(team.home_advantage ?? 4) * 5 * RATING_WEIGHTS.homeAdvantage +
    travelPenaltyScore * 0.02;

  return Number(score.toFixed(2));
}

export function getMatchTeamProfiles(match, teamRatings = null) {
  return {
    home: getTeamProfile(match?.home_team, teamRatings),
    away: getTeamProfile(match?.away_team, teamRatings),
  };
}
