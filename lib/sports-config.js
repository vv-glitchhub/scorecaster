export const SPORTS_CONFIG = {
  icehockey: {
    labelFi: "Jääkiekko",
    leagues: {
      NHL: { labelFi: "NHL", oddsApiSport: "icehockey_nhl" },
      LIIGA: { labelFi: "Liiga 🇫🇮", oddsApiSport: "icehockey_liiga" },
      SHL: { labelFi: "SHL 🇸🇪", oddsApiSport: "icehockey_sweden_hockey_league" },
      DEL: { labelFi: "DEL 🇩🇪", oddsApiSport: "icehockey_germany_del" },
    },
  },

  soccer: {
    labelFi: "Jalkapallo",
    leagues: {
      EPL: { labelFi: "Premier League 🇬🇧", oddsApiSport: "soccer_epl" },
      UCL: { labelFi: "Champions League 🇪🇺", oddsApiSport: "soccer_uefa_champs_league" },
      LALIGA: { labelFi: "La Liga 🇪🇸", oddsApiSport: "soccer_spain_la_liga" },
      SERIEA: { labelFi: "Serie A 🇮🇹", oddsApiSport: "soccer_italy_serie_a" },
      BUNDESLIGA: { labelFi: "Bundesliga 🇩🇪", oddsApiSport: "soccer_germany_bundesliga" },
      LIGUE1: { labelFi: "Ligue 1 🇫🇷", oddsApiSport: "soccer_france_ligue_one" },
    },
  },

  basketball: {
    labelFi: "Koripallo",
    leagues: {
      NBA: { labelFi: "NBA", oddsApiSport: "basketball_nba" },
      EUROLEAGUE: { labelFi: "EuroLeague 🇪🇺", oddsApiSport: "basketball_euroleague" },
    },
  },

  football: {
    labelFi: "NFL / jenkkifutis",
    leagues: {
      NFL: { labelFi: "NFL", oddsApiSport: "americanfootball_nfl" },
      NCAAF: { labelFi: "NCAA Football", oddsApiSport: "americanfootball_ncaaf" },
    },
  },

  baseball: {
    labelFi: "Baseball",
    leagues: {
      MLB: { labelFi: "MLB", oddsApiSport: "baseball_mlb" },
    },
  },

  tennis: {
    labelFi: "Tennis",
    leagues: {
      ATP: { labelFi: "ATP Tennis", oddsApiSport: "tennis_atp" },
      WTA: { labelFi: "WTA Tennis", oddsApiSport: "tennis_wta" },
    },
  },

  mma: {
    labelFi: "UFC / MMA",
    leagues: {
      UFC: { labelFi: "UFC", oddsApiSport: "mma_mixed_martial_arts" },
    },
  },
};

export function getSportOptions() {
  return [
    { id: "all", labelFi: "Kaikki" },
    ...Object.entries(SPORTS_CONFIG).map(([id, value]) => ({
      id,
      labelFi: value.labelFi,
    })),
  ];
}

export function getLeagueOptions(sport) {
  if (sport === "all") {
    return [{ id: "ALL", labelFi: "Kaikki" }];
  }

  const group = SPORTS_CONFIG[sport];

  if (!group) return [{ id: "ALL", labelFi: "Kaikki" }];

  return [
    { id: "ALL", labelFi: "Kaikki" },
    ...Object.entries(group.leagues).map(([id, value]) => ({
      id,
      labelFi: value.labelFi,
    })),
  ];
}

export function getOddsApiSports(sport = "all", league = "ALL") {
  if (sport === "all") {
    return Object.values(SPORTS_CONFIG)
      .flatMap((group) => Object.values(group.leagues))
      .map((leagueItem) => leagueItem.oddsApiSport)
      .filter(Boolean);
  }

  const group = SPORTS_CONFIG[sport];

  if (!group) return ["icehockey_nhl"];

  if (league && league !== "ALL") {
    return [group.leagues?.[league]?.oddsApiSport || Object.values(group.leagues)[0]?.oddsApiSport].filter(Boolean);
  }

  return Object.values(group.leagues)
    .map((leagueItem) => leagueItem.oddsApiSport)
    .filter(Boolean);
}
