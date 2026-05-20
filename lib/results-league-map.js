export const SPORTSDB_LEAGUE_IDS = {
  NHL: "4380",
  NBA: "4387",
  NFL: "4391",
  MLB: "4424",

  EPL: "4328",
  UCL: "4480",
  UEL: "4481",
  LALIGA: "4335",
  SERIEA: "4332",
  BUNDESLIGA: "4331",
  LIGUE1: "4334",

  ATP: "4464",
  WTA: "4465",

  UFC: "4443",
  MMA_ALL: "4443",
  BOXING: "4444",

  PGA: "4466",
  MASTERS: "4466",
};

export function getSportsDbLeagueId(leagueId) {
  return SPORTSDB_LEAGUE_IDS[leagueId] || null;
}
