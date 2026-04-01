function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildFootballTeamRating(players = [], teamName = "Unknown") {
  const starters = players.filter((p) => p.overall > 0);
  const defenders = starters.filter((p) => p.position === "DEF");
  const midfielders = starters.filter((p) => p.position === "MID");
  const forwards = starters.filter((p) => p.position === "FWD");
  const goalkeepers = starters.filter((p) => p.position === "GK");

  const attack =
    average(forwards.map((p) => p.attackComponent)) * 0.55 +
    average(midfielders.map((p) => p.attackComponent)) * 0.30 +
    average(defenders.map((p) => p.attackComponent)) * 0.15;

  const control =
    average(midfielders.map((p) => p.possessionComponent)) * 0.50 +
    average(defenders.map((p) => p.possessionComponent)) * 0.25 +
    average(forwards.map((p) => p.possessionComponent)) * 0.25;

  const defense =
    average(defenders.map((p) => p.defenseComponent)) * 0.50 +
    average(midfielders.map((p) => p.defenseComponent)) * 0.25 +
    average(goalkeepers.map((p) => p.defenseComponent)) * 0.25;

  const form = average(starters.map((p) => p.formComponent));
  const goalie = average(goalkeepers.map((p) => p.defenseComponent));

  const overall =
    attack * 0.30 +
    control * 0.20 +
    defense * 0.25 +
    goalie * 0.15 +
    form * 0.10;

  return {
    team: teamName,
    playerCount: starters.length,
    attack,
    control,
    defense,
    goalie,
    form,
    overall,
  };
}
