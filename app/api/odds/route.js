function futureIso(daysAhead = 0, hour = 18) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function createGame(
  id,
  sportKey,
  home,
  away,
  commenceTime,
  homeOdds,
  awayOdds,
  drawOdds = null
) {
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
      createGame("liiga-2", "icehockey_liiga", "HIFK", "Kärpät", futureIso(2, 18), 2.05, 1.90),
      createGame("liiga-3", "icehockey_liiga", "TPS", "Lukko", futureIso(4, 17), 2.30, 1.75),
    ],
    icehockey_nhl: [
      createGame("nhl-1", "icehockey_nhl", "Boston Bruins", "New York Rangers", futureIso(1, 2), 2.20, 1.80),
      createGame("nhl-2", "icehockey_nhl", "Edmonton Oilers", "Colorado Avalanche", futureIso(2, 3), 2.00, 1.95),
      createGame("nhl-3", "icehockey_nhl", "Toronto Maple Leafs", "Florida Panthers", futureIso(4, 2), 2.10, 1.85),
    ],
    icehockey_allsvenskan: [
      createGame("allsvenskan-1", "icehockey_allsvenskan", "Björklöven", "MoDo", futureIso(1, 19), 2.10, 1.84),
      createGame("allsvenskan-2", "icehockey_allsvenskan", "AIK", "Södertälje", futureIso(3, 19), 2.25, 1.78),
    ],
    icehockey_sweden_hockey_league: [
      createGame("shl-1", "icehockey_sweden_hockey_league", "Frölunda", "Färjestad", futureIso(1, 19), 2.05, 1.90),
      createGame("shl-2", "icehockey_sweden_hockey_league", "Skellefteå", "Luleå", futureIso(3, 19), 1.95, 2.00),
    ],
    icehockey_finland_mestis: [
      createGame("mestis-1", "icehockey_finland_mestis", "Ketterä", "IPK", futureIso(1, 18), 1.85, 2.10),
      createGame("mestis-2", "icehockey_finland_mestis", "Hermes", "RoKi", futureIso(3, 18), 2.05, 1.88),
    ],
    basketball_nba: [
      createGame("nba-1", "basketball_nba", "Boston Celtics", "Milwaukee Bucks", futureIso(1, 2), 1.85, 2.05),
      createGame("nba-2", "basketball_nba", "Denver Nuggets", "Phoenix Suns", futureIso(2, 3), 1.95, 1.95),
      createGame("nba-3", "basketball_nba", "Lakers", "Warriors", futureIso(4, 3), 2.10, 1.84),
    ],
    soccer_epl: [
      createGame("epl-1", "soccer_epl", "Arsenal", "Liverpool", futureIso(1, 17), 2.40, 2.70, 3.40),
      createGame("epl-2", "soccer_epl", "Chelsea", "Tottenham", futureIso(4, 17), 2.30, 2.95, 3.25),
    ],
    americanfootball_nfl: [
      createGame("nfl-1", "americanfootball_nfl", "Chiefs", "Bills", futureIso(2, 20), 1.88, 2.00),
      createGame("nfl-2", "americanfootball_nfl", "49ers", "Eagles", futureIso(5, 20), 1.95, 1.95),
    ],
  };

  return data[sport] || [];
}

function filterUpcomingGames(games) {
  const now = Date.now();
  const minStart = now + 15 * 60 * 1000;
  const maxStart = now + 7 * 24 * 60 * 60 * 1000;

  return games
    .filter((game) => {
      const ts = new Date(game.commence_time).getTime();
      return Number.isFinite(ts) && ts >= minStart && ts <= maxStart;
    })
    .sort(
      (a, b) =>
        new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
    );
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport") || "icehockey_liiga";
    const demo = searchParams.get("demo") === "1";

    if (demo) {
      return Response.json({
        fallback: true,
        reason: "demo_mode",
        sport,
        data: filterUpcomingGames(getFallbackGames(sport)),
      });
    }

    if (!process.env.ODDS_API_KEY) {
      return Response.json({
        fallback: true,
        reason: "missing_api_key",
        sport,
        data: filterUpcomingGames(getFallbackGames(sport)),
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
        data: filterUpcomingGames(getFallbackGames(sport)),
      });
    }

    const filtered = filterUpcomingGames(data);

    if (!filtered.length) {
      return Response.json({
        fallback: true,
        reason: "empty_live_data",
        sport,
        data: filterUpcomingGames(getFallbackGames(sport)),
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
