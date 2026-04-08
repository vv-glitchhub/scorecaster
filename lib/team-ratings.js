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

// 🔥 VANHA SIMULAATTORI TARVITSEE NÄMÄ
export const DEFAULT_TEAM_DATA = DEFAULT_TEAM_PROFILE;

export const RATING_WEIGHTS = {
  attack: 0.3,
  defense: 0.3,
  form: 0.15,
  rest: 0.1,
  injuries: -0.1,
  lineup: 0.15,
};

// DEMO DATA
const DEMO_TEAM_RATINGS = {
  Tappara: {
    team_name: "Tappara",
    attack_rating: 78,
    defense_rating: 74,
    form_last_5: 76,
    rest_days: 3,
    travel_km: 35,
    injuries_count: 1,
    lineup_stability: 82,
    home_advantage: 6,
  },
  Ilves: {
    team_name: "Ilves",
    attack_rating: 74,
    defense_rating: 72,
    form_last_5: 68,
    rest_days: 2,
    travel_km: 25,
    injuries_count: 2,
    lineup_stability: 75,
    home_advantage: 5,
  },
};

// --- HELPERS ---

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

  if (Array.isArray(teamRatings)) {
    const found = teamRatings.find((t) => t.team_name === teamName);
    if (found) return found;
  }

  if (DEMO_TEAM_RATINGS[teamName]) {
    return DEMO_TEAM_RATINGS[teamName];
  }

  return getDefaultTeamProfile(teamName);
}

// 🔥 SIMULAATTORI TARVITSEE TÄMÄN
export function getAllTeamRatings() {
  return Object.values(DEMO_TEAM_RATINGS);
}

// 🔥 SIMULAATTORI TARVITSEE TÄMÄN
export function getOverallRating(team) {
  if (!team) return 50;

  return (
    team.attack_rating * RATING_WEIGHTS.attack +
    team.defense_rating * RATING_WEIGHTS.defense +
    team.form_last_5 * RATING_WEIGHTS.form +
    team.rest_days * 5 * RATING_WEIGHTS.rest +
    (100 - team.injuries_count * 5) * RATING_WEIGHTS.injuries +
    team.lineup_stability * RATING_WEIGHTS.lineup
  );
}

export function getMatchTeamProfiles(match, teamRatings = null) {
  return {
    home: getTeamProfile(match?.home_team, teamRatings),
    away: getTeamProfile(match?.away_team, teamRatings),
  };
}
