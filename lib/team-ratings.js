export const DEFAULT_TEAM_DATA = {
  Canada: { attack: 92, defense: 90, goalie: 91, form: 89 },
  Sweden: { attack: 89, defense: 90, goalie: 89, form: 87 },
  Finland: { attack: 86, defense: 89, goalie: 90, form: 86 },
  USA: { attack: 88, defense: 85, goalie: 84, form: 86 },
  Czechia: { attack: 84, defense: 83, goalie: 83, form: 84 },
  Switzerland: { attack: 81, defense: 84, goalie: 84, form: 83 },
  Germany: { attack: 78, defense: 79, goalie: 79, form: 79 },
  Slovakia: { attack: 77, defense: 76, goalie: 76, form: 76 },
  Latvia: { attack: 74, defense: 75, goalie: 76, form: 75 },
  Denmark: { attack: 72, defense: 73, goalie: 72, form: 72 },
  Norway: { attack: 70, defense: 70, goalie: 70, form: 69 },
  Austria: { attack: 68, defense: 68, goalie: 68, form: 68 },
  France: { attack: 67, defense: 67, goalie: 67, form: 67 },
  Slovenia: { attack: 65, defense: 65, goalie: 65, form: 65 },
  Kazakhstan: { attack: 66, defense: 65, goalie: 65, form: 65 },
  Hungary: { attack: 63, defense: 63, goalie: 63, form: 63 },
};

export const RATING_WEIGHTS = {
  attack: 0.35,
  defense: 0.3,
  goalie: 0.2,
  form: 0.15,
};

export function getTeamProfile(teamName, customData = {}) {
  return customData[teamName] || DEFAULT_TEAM_DATA[teamName] || {
    attack: 70,
    defense: 70,
    goalie: 70,
    form: 70,
  };
}

export function getOverallRating(teamName, customData = {}) {
  const team = getTeamProfile(teamName, customData);

  return (
    team.attack * RATING_WEIGHTS.attack +
    team.defense * RATING_WEIGHTS.defense +
    team.goalie * RATING_WEIGHTS.goalie +
    team.form * RATING_WEIGHTS.form
  );
}

export function getAllTeamRatings(customData = DEFAULT_TEAM_DATA) {
  return Object.keys(customData)
    .map((team) => {
      const profile = getTeamProfile(team, customData);
      const overall = getOverallRating(team, customData);

      return {
        team,
        attack: profile.attack,
        defense: profile.defense,
        goalie: profile.goalie,
        form: profile.form,
        overall,
      };
    })
    .sort((a, b) => b.overall - a.overall);
}
