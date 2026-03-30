const SPORT_GROUP_LEAGUES = {
  icehockey: [
    "icehockey_liiga",
    "icehockey_nhl",
    "icehockey_allsvenskan",
    "icehockey_sweden_hockey_league",
    "icehockey_finland_mestis",
    "icehockey_germany_del",
    "icehockey_switzerland_nla",
    "icehockey_czech_extraliga",
  ],
  basketball: [
    "basketball_nba",
    "basketball_euroleague",
    "basketball_ncaab",
  ],
  soccer: [
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
    "soccer_germany_bundesliga",
    "soccer_france_ligue_one",
    "soccer_finland_veikkausliiga",
    "soccer_uefa_champs_league",
  ],
  americanfootball: [
    "americanfootball_nfl",
    "americanfootball_ncaaf",
  ],
};

function normalizeBookmakers(bookmakers = []) {
  return bookmakers
    .map((bookmaker) => {
      const mergedOutcomes = [];

      for (const market of bookmaker.markets || []) {
        if (market?.key === "h2h" || market?.key === "h2h_3_way") {
          for (const outcome of market.outcomes || []) {
            if (
              outcome &&
              typeof outcome.name === "string" &&
              typeof outcome.price === "number"
            ) {
              mergedOutcomes.push({
                name: outcome.name,
                price: outcome.price,
              });
            }
          }
        }
      }

      if (!mergedOutcomes.length) return null;

      return {
        ...bookmaker,
        markets: [
          {
            key: "h2h",
            outcomes: mergedOutcomes,
          },
        ],
      };
    })
    .filter(Boolean);
}

function filterUpcomingGames(games, daysAhead = 3) {
  const now = Date.now();
  const minStart = now - 6 * 60 * 60 * 1000;
  const maxStart = now + daysAhead * 24 * 60 * 60 * 1000;

  return (games || [])
    .map((game) => ({
      ...game,
      bookmakers: normalizeBookmakers(game.bookmakers || []),
    }))
    .filter((game) => {
      const ts = new Date(game.commence_time).getTime();
      const hasOdds =
        Array.isArray(game.bookmakers) && game.bookmakers.length > 0;

      return Number.isFinite(ts) && ts >= minStart && ts <= maxStart && hasOdds;
    })
    .sort(
      (a, b) =>
        new Date(a.commence_time).getTime() -
        new Date(b.commence_time).getTime()
    );
}

async function fetchOddsForSport(sport, apiKey) {
  const url =
    `https://api.the-odds-api.com/v4/sports/${sport}/odds` +
    `?apiKey=${apiKey}` +
    `&regions=us,eu,uk` +
    `&markets=h2h` +
    `&oddsFormat=decimal` +
    `&dateFormat=iso`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      ok: false,
      sport,
      rawCount: 0,
      filteredCount: 0,
      data: [],
      error: data || `HTTP ${res.status}`,
    };
  }

  if (!Array.isArray(data)) {
    return {
      ok: false,
      sport,
      rawCount: 0,
      filteredCount: 0,
      data: [],
      error: "Response was not an array",
    };
  }

  const filtered = filterUpcomingGames(data, 3);

  return {
    ok: true,
    sport,
    rawCount: data.length,
    filteredCount: filtered.length,
    data: filtered,
    error: null,
  };
}

function makeDemoFallback(group, sport) {
  const now = Date.now();

  const fallbackByGroup = {
    icehockey: [
      {
        id: "demo-ice-1",
        sport_key: sport,
        home_team: "Boston Bruins",
        away_team: "New York Rangers",
        commence_time: new Date(now + 8 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          {
            key: "demo",
            title: "DemoOdds",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Boston Bruins", price: 2.2 },
                  { name: "New York Rangers", price: 1.8 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "demo-ice-2",
        sport_key: sport,
        home_team: "Edmonton Oilers",
        away_team: "Colorado Avalanche",
        commence_time: new Date(now + 20 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          {
            key: "demo",
            title: "DemoOdds",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Edmonton Oilers", price: 2.05 },
                  { name: "Colorado Avalanche", price: 1.87 },
                ],
              },
            ],
          },
        ],
      },
    ],
    basketball: [
      {
        id: "demo-basket-1",
        sport_key: sport,
        home_team: "Boston Celtics",
        away_team: "Milwaukee Bucks",
        commence_time: new Date(now + 7 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          {
            key: "demo",
            title: "DemoOdds",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Boston Celtics", price: 1.78 },
                  { name: "Milwaukee Bucks", price: 2.15 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "demo-basket-2",
        sport_key: sport,
        home_team: "Denver Nuggets",
        away_team: "Phoenix Suns",
        commence_time: new Date(now + 18 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          {
            key: "demo",
            title: "DemoOdds",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Denver Nuggets", price: 1.92 },
                  { name: "Phoenix Suns", price: 1.98 },
                ],
              },
            ],
          },
        ],
      },
    ],
    soccer: [
      {
        id: "demo-soccer-1",
        sport_key: sport,
        home_team: "Liverpool",
        away_team: "Arsenal",
        commence_time: new Date(now + 10 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          {
            key: "demo",
            title: "DemoOdds",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Liverpool", price: 2.1 },
                  { name: "Draw", price: 3.55 },
                  { name: "Arsenal", price: 3.1 },
                ],
              },
            ],
          },
        ],
      },
    ],
    americanfootball: [
      {
        id: "demo-nfl-1",
        sport_key: sport,
        home_team: "Kansas City Chiefs",
        away_team: "Buffalo Bills",
        commence_time: new Date(now + 12 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          {
            key: "demo",
            title: "DemoOdds",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Kansas City Chiefs", price: 1.74 },
                  { name: "Buffalo Bills", price: 2.2 },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  return fallbackByGroup[group] || [];
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport") || "icehockey_nhl";
    const group = searchParams.get("group") || "icehockey";
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return Response.json({
        fallback: true,
        reason: "missing_api_key",
        sport,
        group,
        sourceSport: null,
        rawCount: 0,
        filteredCount: 0,
        data: makeDemoFallback(group, sport),
      });
    }

    const primary = await fetchOddsForSport(sport, apiKey);

    if (primary.ok && primary.data.length > 0) {
      return Response.json({
        fallback: false,
        reason: null,
        sport,
        group,
        sourceSport: sport,
        rawCount: primary.rawCount,
        filteredCount: primary.filteredCount,
        data: primary.data,
      });
    }

    const candidates = [...new Set(SPORT_GROUP_LEAGUES[group] || [])].filter(
      (leagueKey) => leagueKey !== sport
    );

    const results = await Promise.all(
      candidates.map((candidateSport) => fetchOddsForSport(candidateSport, apiKey))
    );

    const combined = results
      .filter((r) => r.ok && r.data.length > 0)
      .flatMap((r) =>
        r.data.map((game) => ({
          ...game,
          source_sport: r.sport,
        }))
      )
      .sort(
        (a, b) =>
          new Date(a.commence_time).getTime() -
          new Date(b.commence_time).getTime()
      );

    if (combined.length > 0) {
      return Response.json({
        fallback: false,
        reason: "used_next_available_game",
        sport,
        group,
        sourceSport: combined[0]?.source_sport || null,
        rawCount: primary.rawCount || 0,
        filteredCount: combined.length,
        data: combined.slice(0, 10),
      });
    }

    return Response.json({
      fallback: true,
      reason: "api_empty_using_demo_fallback",
      sport,
      group,
      sourceSport: null,
      rawCount: primary.rawCount || 0,
      filteredCount: 0,
      apiError: primary.error || null,
      data: makeDemoFallback(group, sport),
    });
  } catch (error) {
    return Response.json({
      fallback: true,
      reason: "server_error",
      sport: null,
      group: null,
      sourceSport: null,
      rawCount: 0,
      filteredCount: 0,
      error: String(error),
      data: makeDemoFallback("icehockey", "icehockey_nhl"),
    });
  }
}
