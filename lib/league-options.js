export const SPORT_OPTIONS = [
  { id: "all", labelFi: "Kaikki", labelEn: "All" },
  { id: "icehockey", labelFi: "Jääkiekko", labelEn: "Ice hockey" },
  { id: "soccer", labelFi: "Jalkapallo", labelEn: "Football" },
  { id: "basketball", labelFi: "Koripallo", labelEn: "Basketball" },
  { id: "americanfootball", labelFi: "NFL / jenkkifutis", labelEn: "NFL / American football" },
  { id: "baseball", labelFi: "Baseball", labelEn: "Baseball" },

  { id: "tennis", labelFi: "Tennis", labelEn: "Tennis" },
  { id: "mma", labelFi: "UFC / MMA", labelEn: "UFC / MMA" },
  { id: "boxing", labelFi: "Nyrkkeily", labelEn: "Boxing" },
  { id: "golf", labelFi: "Golf", labelEn: "Golf" },
];

export const LEAGUES = [
  // ICE HOCKEY
  {
    id: "NHL",
    sport: "icehockey",
    labelFi: "NHL",
    labelEn: "NHL",
    oddsApiSport: "icehockey_nhl",
    sgoSport: "HOCKEY",
    sgoLeague: "NHL",
  },
  {
    id: "LIIGA",
    sport: "icehockey",
    labelFi: "Liiga 🇫🇮",
    labelEn: "Liiga 🇫🇮",
    oddsApiSport: "icehockey_finland_liiga",
    sgoSport: "HOCKEY",
    sgoLeague: "LIIGA",
  },
  {
    id: "SHL",
    sport: "icehockey",
    labelFi: "SHL 🇸🇪",
    labelEn: "SHL 🇸🇪",
    oddsApiSport: "icehockey_sweden_hockey_league",
    sgoSport: "HOCKEY",
    sgoLeague: "SHL",
  },
  {
    id: "DEL",
    sport: "icehockey",
    labelFi: "DEL 🇩🇪",
    labelEn: "DEL 🇩🇪",
    oddsApiSport: "icehockey_germany_del",
    sgoSport: "HOCKEY",
    sgoLeague: "DEL",
  },

  // SOCCER
  {
    id: "EPL",
    sport: "soccer",
    labelFi: "Premier League 🇬🇧",
    labelEn: "Premier League 🇬🇧",
    oddsApiSport: "soccer_epl",
    sgoSport: "SOCCER",
    sgoLeague: "EPL",
  },
  {
    id: "UCL",
    sport: "soccer",
    labelFi: "Champions League 🇪🇺",
    labelEn: "Champions League 🇪🇺",
    oddsApiSport: "soccer_uefa_champs_league",
    sgoSport: "SOCCER",
    sgoLeague: "UEFA_CHAMPIONS_LEAGUE",
  },
  {
    id: "UEL",
    sport: "soccer",
    labelFi: "Europa League 🇪🇺",
    labelEn: "Europa League 🇪🇺",
    oddsApiSport: "soccer_uefa_europa_league",
    sgoSport: "SOCCER",
    sgoLeague: "UEFA_EUROPA_LEAGUE",
  },
  {
    id: "LALIGA",
    sport: "soccer",
    labelFi: "La Liga 🇪🇸",
    labelEn: "La Liga 🇪🇸",
    oddsApiSport: "soccer_spain_la_liga",
    sgoSport: "SOCCER",
    sgoLeague: "LALIGA",
  },
  {
    id: "SERIEA",
    sport: "soccer",
    labelFi: "Serie A 🇮🇹",
    labelEn: "Serie A 🇮🇹",
    oddsApiSport: "soccer_italy_serie_a",
    sgoSport: "SOCCER",
    sgoLeague: "SERIE_A",
  },
  {
    id: "BUNDESLIGA",
    sport: "soccer",
    labelFi: "Bundesliga 🇩🇪",
    labelEn: "Bundesliga 🇩🇪",
    oddsApiSport: "soccer_germany_bundesliga",
    sgoSport: "SOCCER",
    sgoLeague: "BUNDESLIGA",
  },
  {
    id: "LIGUE1",
    sport: "soccer",
    labelFi: "Ligue 1 🇫🇷",
    labelEn: "Ligue 1 🇫🇷",
    oddsApiSport: "soccer_france_ligue_one",
    sgoSport: "SOCCER",
    sgoLeague: "LIGUE_1",
  },
  {
    id: "VEIKKAUSLIIGA",
    sport: "soccer",
    labelFi: "Veikkausliiga 🇫🇮",
    labelEn: "Veikkausliiga 🇫🇮",
    oddsApiSport: "soccer_finland_veikkausliiga",
    sgoSport: "SOCCER",
    sgoLeague: "VEIKKAUSLIIGA",
  },

  // BASKETBALL
  {
    id: "NBA",
    sport: "basketball",
    labelFi: "NBA",
    labelEn: "NBA",
    oddsApiSport: "basketball_nba",
    sgoSport: "BASKETBALL",
    sgoLeague: "NBA",
  },
  {
    id: "EUROLEAGUE",
    sport: "basketball",
    labelFi: "EuroLeague 🇪🇺",
    labelEn: "EuroLeague 🇪🇺",
    oddsApiSport: "basketball_euroleague",
    sgoSport: "BASKETBALL",
    sgoLeague: "EUROLEAGUE",
  },

  // AMERICAN FOOTBALL / BASEBALL
  {
    id: "NFL",
    sport: "americanfootball",
    labelFi: "NFL",
    labelEn: "NFL",
    oddsApiSport: "americanfootball_nfl",
    sgoSport: "FOOTBALL",
    sgoLeague: "NFL",
  },
  {
    id: "MLB",
    sport: "baseball",
    labelFi: "MLB",
    labelEn: "MLB",
    oddsApiSport: "baseball_mlb",
    sgoSport: "BASEBALL",
    sgoLeague: "MLB",
  },

  // TENNIS
  {
    id: "ATP",
    sport: "tennis",
    labelFi: "ATP Tennis",
    labelEn: "ATP Tennis",
    oddsApiSport: "tennis_atp",
    sgoSport: "TENNIS",
    sgoLeague: "ATP",
  },
  {
    id: "WTA",
    sport: "tennis",
    labelFi: "WTA Tennis",
    labelEn: "WTA Tennis",
    oddsApiSport: "tennis_wta",
    sgoSport: "TENNIS",
    sgoLeague: "WTA",
  },

  // MMA / UFC
  {
    id: "UFC",
    sport: "mma",
    labelFi: "UFC",
    labelEn: "UFC",
    oddsApiSport: "mma_mixed_martial_arts",
    sgoSport: "MMA",
    sgoLeague: "UFC",
  },
  {
    id: "MMA_ALL",
    sport: "mma",
    labelFi: "MMA kaikki",
    labelEn: "MMA all",
    oddsApiSport: "mma_mixed_martial_arts",
    sgoSport: "MMA",
    sgoLeague: "MMA",
  },

  // BOXING
  {
    id: "BOXING",
    sport: "boxing",
    labelFi: "Nyrkkeily",
    labelEn: "Boxing",
    oddsApiSport: "boxing_boxing",
    sgoSport: "BOXING",
    sgoLeague: "BOXING",
  },

  // GOLF
  {
    id: "PGA",
    sport: "golf",
    labelFi: "PGA Tour",
    labelEn: "PGA Tour",
    oddsApiSport: "golf_pga_championship_winner",
    sgoSport: "GOLF",
    sgoLeague: "PGA",
  },
  {
    id: "MASTERS",
    sport: "golf",
    labelFi: "Masters",
    labelEn: "Masters",
    oddsApiSport: "golf_masters_tournament_winner",
    sgoSport: "GOLF",
    sgoLeague: "MASTERS",
  },
];

export function getLeaguesForSport(sport = "all") {
  if (sport === "all") return LEAGUES;
  return LEAGUES.filter((league) => league.sport === sport);
}

export function getLeagueById(id) {
  return LEAGUES.find((league) => league.id === id) || null;
}
