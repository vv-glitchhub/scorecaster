export const SPORT_MODEL_PROFILES = {
  icehockey: {
    homeAdvantage: 0.06,
    fatigueImpact: 0.07,
    offenseImpact: 0.22,
    defenseImpact: 0.22,
    goalieImpact: 0.18,
    formImpact: 0.15,
    injuriesImpact: 0.10,
  },

  soccer: {
    homeAdvantage: 0.08,
    fatigueImpact: 0.05,
    offenseImpact: 0.24,
    defenseImpact: 0.24,
    formImpact: 0.18,
    injuriesImpact: 0.10,
  },

  basketball: {
    homeAdvantage: 0.05,
    fatigueImpact: 0.12,
    offenseImpact: 0.30,
    defenseImpact: 0.18,
    formImpact: 0.18,
    injuriesImpact: 0.12,
  },

  tennis: {
    fatigueImpact: 0.18,
    formImpact: 0.22,
    surfaceImpact: 0.25,
    rankingImpact: 0.20,
    h2hImpact: 0.15,
  },

  mma: {
    strikingImpact: 0.20,
    grapplingImpact: 0.20,
    reachImpact: 0.10,
    ageImpact: 0.10,
    formImpact: 0.20,
    cardioImpact: 0.20,
  },

  golf: {
    formImpact: 0.30,
    puttingImpact: 0.20,
    courseFitImpact: 0.25,
    weatherImpact: 0.10,
    drivingImpact: 0.15,
  },
};

export function getSportProfile(sportKey = "") {
  const key = String(sportKey).toLowerCase();

  if (key.includes("nhl") || key.includes("hockey")) {
    return SPORT_MODEL_PROFILES.icehockey;
  }

  if (
    key.includes("soccer") ||
    key.includes("football") ||
    key.includes("premier")
  ) {
    return SPORT_MODEL_PROFILES.soccer;
  }

  if (key.includes("nba") || key.includes("basketball")) {
    return SPORT_MODEL_PROFILES.basketball;
  }

  if (key.includes("tennis")) {
    return SPORT_MODEL_PROFILES.tennis;
  }

  if (
    key.includes("mma") ||
    key.includes("ufc") ||
    key.includes("boxing")
  ) {
    return SPORT_MODEL_PROFILES.mma;
  }

  if (key.includes("golf")) {
    return SPORT_MODEL_PROFILES.golf;
  }

  return SPORT_MODEL_PROFILES.icehockey;
}
