export const SPORT_OPTIONS = [
  { id: "all", labelFi: "Kaikki", labelEn: "All" },
  { id: "icehockey", labelFi: "Jääkiekko", labelEn: "Ice hockey" },
  { id: "soccer", labelFi: "Jalkapallo", labelEn: "Football" },
  { id: "basketball", labelFi: "Koripallo", labelEn: "Basketball" },
  { id: "americanfootball", labelFi: "NFL", labelEn: "NFL" },
  { id: "baseball", labelFi: "Baseball", labelEn: "Baseball" },
];

export const LEAGUES = [
  { id: "NHL", sport: "icehockey", labelFi: "NHL", labelEn: "NHL", oddsApiSport: "icehockey_nhl", sgoSport: "HOCKEY", sgoLeague: "NHL" },
  { id: "LIIGA", sport: "icehockey", labelFi: "Liiga 🇫🇮", labelEn: "Liiga 🇫🇮", oddsApiSport: "icehockey_finland_liiga", sgoSport: "HOCKEY", sgoLeague: "LIIGA" },
  { id: "SHL", sport: "icehockey", labelFi: "SHL 🇸🇪", labelEn: "SHL 🇸🇪", oddsApiSport: "icehockey_sweden_hockey_league", sgoSport: "HOCKEY", sgoLeague: "SHL" },
  { id: "DEL", sport: "icehockey", labelFi: "DEL 🇩🇪", labelEn: "DEL 🇩🇪", oddsApiSport: "icehockey_germany_del", sgoSport: "HOCKEY", sgoLeague: "DEL" },

  { id: "EPL", sport: "soccer", labelFi: "Premier League 🇬🇧", labelEn: "Premier League 🇬🇧", oddsApiSport: "soccer_epl", sgoSport: "SOCCER", sgoLeague: "EPL" },
  { id: "UCL", sport: "soccer", labelFi: "Champions League 🇪🇺", labelEn: "Champions League 🇪🇺", oddsApiSport: "soccer_uefa_champs_league", sgoSport: "SOCCER", sgoLeague: "UEFA_CHAMPIONS_LEAGUE" },
  { id: "UEL", sport: "soccer", labelFi: "Europa League 🇪🇺", labelEn: "Europa League 🇪🇺", oddsApiSport: "soccer_uefa_europa_league", sgoSport: "SOCCER", sgoLeague: "UEFA_EUROPA_LEAGUE" },
  { id: "LALIGA", sport: "soccer", labelFi: "La Liga 🇪🇸", labelEn: "La Liga 🇪🇸", oddsApiSport: "soccer_spain_la_liga", sgoSport: "SOCCER", sgoLeague: "LALIGA" },
  { id: "SERIEA", sport: "soccer", labelFi: "Serie A 🇮🇹", labelEn: "Serie A 🇮🇹", oddsApiSport: "soccer_italy_serie_a", sgoSport: "SOCCER", sgoLeague: "SERIE_A" },
  { id: "BUNDESLIGA", sport: "soccer", labelFi: "Bundesliga 🇩🇪", labelEn: "Bundesliga 🇩🇪", oddsApiSport: "soccer_germany_bundesliga", sgoSport: "SOCCER", sgoLeague: "BUNDESLIGA" },
  { id: "LIGUE1", sport: "soccer", labelFi: "Ligue 1 🇫🇷", labelEn: "Ligue 1 🇫🇷", oddsApiSport: "soccer_france_ligue_one", sgoSport: "SOCCER", sgoLeague: "LIGUE_1" },
  { id: "VEIKKAUSLIIGA", sport: "soccer", labelFi: "Veikkausliiga 🇫🇮", labelEn: "Veikkausliiga 🇫🇮", oddsApiSport: "soccer_finland_veikkausliiga", sgoSport: "SOCCER", sgoLeague: "VEIKKAUSLIIGA" },

  { id: "NBA", sport: "basketball", labelFi: "NBA", labelEn: "NBA", oddsApiSport: "basketball_nba", sgoSport: "BASKETBALL", sgoLeague: "NBA" },
  { id: "EUROLEAGUE", sport: "basketball", labelFi: "EuroLeague 🇪🇺", labelEn: "EuroLeague 🇪🇺", oddsApiSport: "basketball_euroleague", sgoSport: "BASKETBALL", sgoLeague: "EUROLEAGUE" },

  { id: "NFL", sport: "americanfootball", labelFi: "NFL", labelEn: "NFL", oddsApiSport: "americanfootball_nfl", sgoSport: "FOOTBALL", sgoLeague: "NFL" },
  { id: "MLB", sport: "baseball", labelFi: "MLB", labelEn: "MLB", oddsApiSport: "baseball_mlb", sgoSport: "BASEBALL", sgoLeague: "MLB" },
];

export function getLeaguesForSport(sport = "all") {
  if (sport === "all") return LEAGUES;
  return LEAGUES.filter((l) => l.sport === sport);
}

export function getLeagueById(id) {
  return LEAGUES.find((l) => l.id === id) || null;
}
