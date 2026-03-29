function futureIso(daysAhead = 0, hour = 18) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function createGame(id, sportKey, home, away, commenceTime, homeOdds, awayOdds, drawOdds = null) {
  const outcomes = [
    { name: home, price: homeOdds },
    { name: away, price: awayOdds },
  ];

  if (drawOdds !== null) {
    outcomes.splice(1, 0, { name: "Draw", price: drawOdds });
  }

  return {
    id,
    sport_key: sportKey,
    home_team: home,
    away_team: away,
    commence_time: commenceTime,
    bookmakers: [
      {
        key: "samplebook",
        title: "SampleBook",
        markets: [
          {
            key: "h2h",
            outcomes,
          },
        ],
      },
      {
        key: "demoodds",
        title: "DemoOdds",
        markets: [
          {
            key: "h2h",
            outcomes: outcomes.map((o, index) => ({
              ...o,
              price:
                index === 0
                  ? Number((o.price + 0.05).toFixed(2))
                  : Number((o.price - 0.02).toFixed(2)),
            })),
          },
        ],
      },
    ],
  };
}

function getFallbackGames(sport) {
  const data = {
    icehockey_liiga: [
      createGame("liiga-1", "icehockey_liiga", "Tappara", "Ilves", futureIso(0, 18), 2.15, 1.82),
      createGame("liiga-2", "icehockey_liiga", "HIFK", "Kärpät", futureIso(1, 18), 2.05, 1.90),
      createGame("liiga-3", "icehockey_liiga", "TPS", "Lukko", futureIso(2, 17), 2.30, 1.75),
    ],
    icehockey_nhl: [
      createGame("nhl-1", "icehockey_nhl", "Boston Bruins", "New York Rangers", futureIso(0, 20), 2.20, 1.80),
      createGame("nhl-2", "icehockey_nhl", "Edmonton Oilers", "Colorado Avalanche", futureIso(1, 21), 2.00, 1.95),
      createGame("nhl-3", "icehockey_nhl", "Toronto Maple Leafs", "Florida Panthers", futureIso(2, 21), 2.10, 1.85),
    ],
    icehockey_allsvenskan: [
      createGame("allsvenskan-1", "icehockey_allsvenskan", "Björklöven", "MoDo", futureIso(0, 19), 2.10, 1.84),
      createGame("allsvenskan-2", "icehockey_allsvenskan", "AIK", "Södertälje", futureIso(1, 19), 2.25, 1.78),
    ],
    icehockey_sweden_hockey_league: [
      createGame("shl-1", "icehockey_sweden_hockey_league", "Frölunda", "Färjestad", futureIso(0, 19), 2.05, 1.90),
      createGame("shl-2", "icehockey_sweden_hockey_league", "Skellefteå", "Luleå", futureIso(1, 19), 1.95, 2.00),
    ],
    icehockey_finland_mestis: [
      createGame("mestis-1", "icehockey_finland_mestis", "Ketterä", "Jukurit Akatemia", futureIso(0, 18), 1.85, 2.10),
      createGame("mestis-2", "icehockey_finland_mestis", "IPK", "Hermes", futureIso(1, 18), 2.05, 1.88),
    ],
    icehockey_germany_del: [
      createGame("del-1", "icehockey_germany_del", "Eisbären Berlin", "Adler Mannheim", futureIso(0, 19), 2.00, 1.95),
      createGame("del-2", "icehockey_germany_del", "Kölner Haie", "München", futureIso(1, 19), 2.30, 1.75),
    ],
    icehockey_switzerland_nla: [
      createGame("nla-1", "icehockey_switzerland_nla", "ZSC Lions", "Bern", futureIso(0, 19), 1.90, 2.00),
      createGame("nla-2", "icehockey_switzerland_nla", "Lugano", "Fribourg", futureIso(1, 19), 2.10, 1.84),
    ],
    icehockey_czech_extraliga: [
      createGame("extra-1", "icehockey_czech_extraliga", "Sparta Praha", "Kometa Brno", futureIso(0, 19), 1.88, 2.05),
      createGame("extra-2", "icehockey_czech_extraliga", "Pardubice", "Třinec", futureIso(1, 19), 2.00, 1.95),
    ],
    basketball_nba: [
      createGame("nba-1", "basketball_nba", "Boston Celtics", "Milwaukee Bucks", futureIso(0, 20), 1.85, 2.05),
      createGame("nba-2", "basketball_nba", "Denver Nuggets", "Phoenix Suns", futureIso(1, 21), 1.95, 1.95),
      createGame("nba-3", "basketball_nba", "Lakers", "Warriors", futureIso(2, 21), 2.10, 1.84),
    ],
    basketball_euroleague: [
      createGame("euroleague-1", "basketball_euroleague", "Real Madrid", "Barcelona", futureIso(0, 20), 1.92, 1.98),
      createGame("euroleague-2", "basketball_euroleague", "Fenerbahce", "Olympiacos", futureIso(1, 20), 2.02, 1.90),
    ],
    basketball_ncaab: [
      createGame("ncaab-1", "basketball_ncaab", "Duke", "Kansas", futureIso(0, 22), 1.90, 2.00),
      createGame("ncaab-2", "basketball_ncaab", "UCLA", "Arizona", futureIso(1, 22), 2.05, 1.87),
    ],
    soccer_epl: [
      createGame("epl-1", "soccer_epl", "Arsenal", "Liverpool", futureIso(0, 17), 2.40, 2.70, 3.40),
      createGame("epl-2", "soccer_epl", "Chelsea", "Tottenham", futureIso(1, 17), 2.30, 2.95, 3.25),
    ],
    soccer_spain_la_liga: [
      createGame("laliga-1", "soccer_spain_la_liga", "Barcelona", "Atletico Madrid", futureIso(0, 18), 2.10, 3.10, 3.30),
      createGame("laliga-2", "soccer_spain_la_liga", "Sevilla", "Villarreal", futureIso(1, 18), 2.50, 2.75, 3.20),
    ],
    soccer_italy_serie_a: [
      createGame("seriea-1", "soccer_italy_serie_a", "Inter", "Juventus", futureIso(0, 18), 2.15, 3.00, 3.10),
      createGame("seriea-2", "soccer_italy_serie_a", "Milan", "Napoli", futureIso(1, 18), 2.35, 2.85, 3.15),
    ],
    soccer_germany_bundesliga: [
      createGame("bundes-1", "soccer_germany_bundesliga", "Bayern", "Dortmund", futureIso(0, 18), 1.90, 3.60, 3.80),
      createGame("bundes-2", "soccer_germany_bundesliga", "Leipzig", "Leverkusen", futureIso(1, 18), 2.45, 2.70, 3.35),
    ],
    soccer_france_ligue_one: [
      createGame("ligue1-1", "soccer_france_ligue_one", "PSG", "Monaco", futureIso(0, 18), 1.75, 4.10, 3.90),
      createGame("ligue1-2", "soccer_france_ligue_one", "Lyon", "Marseille", futureIso(1, 18), 2.55, 2.65, 3.25),
    ],
    soccer_finland_veikkausliiga: [
      createGame("veikkaus-1", "soccer_finland_veikkausliiga", "HJK", "KuPS", futureIso(0, 18), 2.20, 2.95, 3.10),
      createGame("veikkaus-2", "soccer_finland_veikkausliiga", "Ilves", "SJK", futureIso(1, 18), 2.35, 2.85, 3.05),
    ],
    soccer_uefa_champs_league: [
      createGame("ucl-1", "soccer_uefa_champs_league", "Manchester City", "Real Madrid", futureIso(0, 21), 2.10, 3.15, 3.50),
      createGame("ucl-2", "soccer_uefa_champs_league", "Bayern", "PSG", futureIso(1, 21), 2.20, 3.00, 3.45),
    ],
    americanfootball_nfl: [
      createGame("nfl-1", "americanfootball_nfl", "Chiefs", "Bills", futureIso(0, 20), 1.88, 2.00),
      createGame("nfl-2", "americanfootball_nfl", "49ers", "Eagles", futureIso(1, 20), 1.95, 1.95),
    ],
    americanfootball_ncaaf: [
      createGame("ncaaf-1", "americanfootball_ncaaf", "Alabama", "Georgia", futureIso(0, 21), 2.05, 1.88),
      createGame("ncaaf-2", "americanfootball_ncaaf", "Michigan", "Ohio State", futureIso(1, 21), 1.92, 1.98),
    ],
  };

  return data[sport] || [];
}

function filterNextThreeDays(games) {
  const now = Date.now();
  const max = now + 3 * 24 * 60 * 60 * 1000;

  return games.filter((game) => {
    const ts = new Date(game.commence_time).getTime();
    return Number.isFinite(ts) && ts >= now && ts <= max;
  });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport") || "icehockey_liiga";

    if (!process.env.ODDS_API_KEY) {
      return Response.json({
        fallback: true,
        reason: "missing_api_key",
        sport,
        data: getFallbackGames(sport),
      });
    }

    const url =
      `https://api.the-odds-api.com/v4/sports/${sport}/odds` +
      `?apiKey=${process.env.ODDS_API_KEY}` +
      `&regions=eu,us` +
      `&markets=h2h` +
      `&oddsFormat=decimal` +
      `&dateFormat=iso`;

    const res = await fetch(url, {
      next: { revalidate: 300 },
    });

    const data = await res.json();

    if (!res.ok || !Array.isArray(data)) {
      return Response.json({
        fallback: true,
        reason: "api_error",
        sport,
        data: getFallbackGames(sport),
      });
    }

    const filtered = filterNextThreeDays(data);

    if (!filtered.length) {
      return Response.json({
        fallback: true,
        reason: "empty_live_data",
        sport,
        data: getFallbackGames(sport),
      });
    }

    return Response.json({
      fallback: false,
      reason: null,
      sport,
      data: filtered,
    });
  } catch (error) {
    return Response.json({
      fallback: true,
      reason: "server_error",
      sport: null,
      data: [],
      error: String(error),
    });
  }
}
