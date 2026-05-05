export const SPORT_OPTIONS = [
  { id: "all", labelFi: "Kaikki", labelEn: "All" },
  { id: "hockey", labelFi: "Jääkiekko", labelEn: "Ice Hockey" },
  { id: "soccer", labelFi: "Jalkapallo", labelEn: "Football" },
  { id: "basketball", labelFi: "Koripallo", labelEn: "Basketball" },
  { id: "football", labelFi: "Jenkkifutis", labelEn: "American Football" },
  { id: "baseball", labelFi: "Baseball", labelEn: "Baseball" },
  { id: "finland", labelFi: "Suomi", labelEn: "Finland" },
];

export const LEAGUE_OPTIONS = {
  all: [
    { id: "NHL", sport: "hockey", labelFi: "NHL", labelEn: "NHL", provider: "sportsgameodds" },
    { id: "NBA", sport: "basketball", labelFi: "NBA", labelEn: "NBA", provider: "sportsgameodds" },
    { id: "NFL", sport: "football", labelFi: "NFL", labelEn: "NFL", provider: "sportsgameodds" },
    { id: "MLB", sport: "baseball", labelFi: "MLB", labelEn: "MLB", provider: "sportsgameodds" },
    { id: "EPL", sport: "soccer", labelFi: "Premier League", labelEn: "Premier League", provider: "sportsgameodds" },
    { id: "UCL", sport: "soccer", labelFi: "Champions League", labelEn: "Champions League", provider: "sportsgameodds" },
    { id: "FIN_LIIGA", sport: "hockey", labelFi: "Liiga 🇫🇮", labelEn: "Finnish Liiga 🇫🇮", provider: "thesportsdb" },
    { id: "FIN_VEIKKAUSLIIGA", sport: "soccer", labelFi: "Veikkausliiga 🇫🇮", labelEn: "Veikkausliiga 🇫🇮", provider: "thesportsdb" },
  ],

  hockey: [
    { id: "NHL", sport: "hockey", labelFi: "NHL", labelEn: "NHL", provider: "sportsgameodds" },
    { id: "SHL", sport: "hockey", labelFi: "SHL 🇸🇪", labelEn: "SHL 🇸🇪", provider: "sportsgameodds" },
    { id: "DEL", sport: "hockey", labelFi: "DEL 🇩🇪", labelEn: "DEL 🇩🇪", provider: "sportsgameodds" },
    { id: "CHL", sport: "hockey", labelFi: "CHL 🇪🇺", labelEn: "CHL 🇪🇺", provider: "sportsgameodds" },
    { id: "FIN_LIIGA", sport: "hockey", labelFi: "Liiga 🇫🇮", labelEn: "Finnish Liiga 🇫🇮", provider: "thesportsdb" },
  ],

  soccer: [
    { id: "EPL", sport: "soccer", labelFi: "Premier League 🇬🇧", labelEn: "Premier League 🇬🇧", provider: "sportsgameodds" },
    { id: "UCL", sport: "soccer", labelFi: "Champions League 🇪🇺", labelEn: "Champions League 🇪🇺", provider: "sportsgameodds" },
    { id: "UEL", sport: "soccer", labelFi: "Europa League 🇪🇺", labelEn: "Europa League 🇪🇺", provider: "sportsgameodds" },
    { id: "LALIGA", sport: "soccer", labelFi: "La Liga 🇪🇸", labelEn: "La Liga 🇪🇸", provider: "sportsgameodds" },
    { id: "SERIE_A", sport: "soccer", labelFi: "Serie A 🇮🇹", labelEn: "Serie A 🇮🇹", provider: "sportsgameodds" },
    { id: "BUNDESLIGA", sport: "soccer", labelFi: "Bundesliga 🇩🇪", labelEn: "Bundesliga 🇩🇪", provider: "sportsgameodds" },
    { id: "LIGUE_1", sport: "soccer", labelFi: "Ligue 1 🇫🇷", labelEn: "Ligue 1 🇫🇷", provider: "sportsgameodds" },
    { id: "MLS", sport: "soccer", labelFi: "MLS 🇺🇸", labelEn: "MLS 🇺🇸", provider: "sportsgameodds" },
    { id: "FIN_VEIKKAUSLIIGA", sport: "soccer", labelFi: "Veikkausliiga 🇫🇮", labelEn: "Veikkausliiga 🇫🇮", provider: "thesportsdb" },
    { id: "FIN_CUP", sport: "soccer", labelFi: "Suomen Cup 🇫🇮", labelEn: "Finnish Cup 🇫🇮", provider: "thesportsdb" },
  ],

  basketball: [
    { id: "NBA", sport: "basketball", labelFi: "NBA", labelEn: "NBA", provider: "sportsgameodds" },
    { id: "WNBA", sport: "basketball", labelFi: "WNBA", labelEn: "WNBA", provider: "sportsgameodds" },
    { id: "NCAAB", sport: "basketball", labelFi: "NCAA Basketball", labelEn: "NCAA Basketball", provider: "sportsgameodds" },
    { id: "EUROLEAGUE", sport: "basketball", labelFi: "EuroLeague 🇪🇺", labelEn: "EuroLeague 🇪🇺", provider: "sportsgameodds" },
    { id: "EUROCUP", sport: "basketball", labelFi: "EuroCup 🇪🇺", labelEn: "EuroCup 🇪🇺", provider: "sportsgameodds" },
    { id: "ACB", sport: "basketball", labelFi: "Liga ACB 🇪🇸", labelEn: "Liga ACB 🇪🇸", provider: "sportsgameodds" },
  ],

  football: [
    { id: "NFL", sport: "football", labelFi: "NFL", labelEn: "NFL", provider: "sportsgameodds" },
    { id: "NCAAF", sport: "football", labelFi: "NCAA Football", labelEn: "NCAA Football", provider: "sportsgameodds" },
  ],

  baseball: [
    { id: "MLB", sport: "baseball", labelFi: "MLB", labelEn: "MLB", provider: "sportsgameodds" },
  ],

  finland: [
    { id: "FIN_LIIGA", sport: "hockey", labelFi: "Liiga 🇫🇮", labelEn: "Finnish Liiga 🇫🇮", provider: "thesportsdb" },
    { id: "FIN_VEIKKAUSLIIGA", sport: "soccer", labelFi: "Veikkausliiga 🇫🇮", labelEn: "Veikkausliiga 🇫🇮", provider: "thesportsdb" },
    { id: "FIN_CUP", sport: "soccer", labelFi: "Suomen Cup 🇫🇮", labelEn: "Finnish Cup 🇫🇮", provider: "thesportsdb" },
  ],
};

export const FINNISH_LEAGUE_IDS = {
  FIN_LIIGA: {
    id: "4931",
    title: "Liiga",
    sport: "Ice Hockey",
  },
  FIN_VEIKKAUSLIIGA: {
    id: "4636",
    title: "Veikkausliiga",
    sport: "Soccer",
  },
  FIN_CUP: {
    id: "5186",
    title: "Finnish Cup",
    sport: "Soccer",
  },
};

export function getLeaguesForSport(sport) {
  return LEAGUE_OPTIONS[sport] || LEAGUE_OPTIONS.all;
}

export function getLeagueById(id) {
  return Object.values(LEAGUE_OPTIONS)
    .flat()
    .find((league) => league.id === id);
}
