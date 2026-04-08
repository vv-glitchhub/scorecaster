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
  Lukko: {
    team_name: "Lukko",
    attack_rating: 70,
    defense_rating: 76,
    form_last_5: 66,
    rest_days: 3,
    travel_km: 120,
    injuries_count: 1,
    lineup_stability: 78,
    home_advantage: 5,
  },
  TPS: {
    team_name: "TPS",
    attack_rating: 64,
    defense_rating: 62,
    form_last_5: 57,
    rest_days: 2,
    travel_km: 145,
    injuries_count: 3,
    lineup_stability: 66,
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
        travel_km: clamp(found.travel_km ?? 0, 0, 5000),
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

export function getMatchTeamProfiles(match, teamRatings = null) {
  return {
    home: getTeamProfile(match?.home_team, teamRatings),
    away: getTeamProfile(match?.away_team, teamRatings),
  };
}
