function createBookmaker(title, homeTeam, awayTeam, homePrice, awayPrice, drawPrice = null) {
  const outcomes = [
    { name: homeTeam, price: homePrice },
    { name: awayTeam, price: awayPrice },
  ];

  if (drawPrice) {
    outcomes.splice(1, 0, { name: "Draw", price: drawPrice });
  }

  return {
    key: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    markets: [
      {
        key: "h2h",
        outcomes,
      },
    ],
  };
}

function getFallbackGames(sport) {
  const now = Date.now();

  const fallbackBySport = {
    icehockey_nhl: [
      {
        id: "fallback-nhl-1",
        sport_key: "icehockey_nhl",
        home_team: "Boston Bruins",
        away_team: "New York Rangers",
        commence_time: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          createBookmaker("SampleBook", "Boston Bruins", "New York Rangers", 2.15, 1.78),
          createBookmaker("DemoOdds", "Boston Bruins", "New York Rangers", 2.2, 1.8),
        ],
      },
      {
        id: "fallback-nhl-2",
        sport_key: "icehockey_nhl",
        home_team: "Edmonton Oilers",
        away_team: "Colorado Avalanche",
        commence_time: new Date(now + 28 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          createBookmaker("SampleBook", "Edmonton Oilers", "Colorado Avalanche", 1.95, 1.95),
          createBookmaker("DemoOdds", "Edmonton Oilers", "Colorado Avalanche", 2.0, 1.91),
        ],
      },
      {
        id: "fallback-nhl-3",
        sport_key: "icehockey_nhl",
        home_team: "Toronto Maple Leafs",
        away_team: "Florida Panthers",
        commence_time: new Date(now + 52 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          createBookmaker("SampleBook", "Toronto Maple Leafs", "Florida Panthers", 2.05, 1.85),
          createBookmaker("DemoOdds", "Toronto Maple Leafs", "Florida Panthers", 2.1, 1.83),
        ],
      },
    ],

    icehockey_liiga: [
      {
        id: "fallback-liiga-1",
        sport_key: "icehockey_liiga",
        home_team: "Tappara",
        away_team: "Ilves",
        commence_time: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          createBookmaker("SampleBook", "Tappara", "Ilves", 2.2, 1.78),
          createBookmaker("DemoOdds", "Tappara", "Ilves", 2.15, 1.8),
        ],
      },
      {
        id: "fallback-liiga-2",
        sport_key: "icehockey_liiga",
        home_team: "HIFK",
        away_team: "Kärpät",
        commence_time: new Date(now + 27 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          createBookmaker("SampleBook", "HIFK", "Kärpät", 1.95, 1.95),
          createBookmaker("DemoOdds", "HIFK", "Kärpät", 2.0, 1.91),
        ],
      },
      {
        id: "fallback-liiga-3",
        sport_key: "icehockey_liiga",
        home_team: "TPS",
        away_team: "Lukko",
        commence_time: new Date(now + 50 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          createBookmaker("SampleBook", "TPS", "Lukko", 2.4, 1.62),
          createBookmaker("DemoOdds", "TPS", "Lukko", 2.35, 1.65),
        ],
      },
    ],

    basketball_nba: [
      {
        id: "fallback-nba-1",
        sport_key: "basketball_nba",
        home_team: "Los Angeles Lakers",
        away_team: "Boston Celtics",
        commence_time: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          createBookmaker("SampleBook", "Los Angeles Lakers", "Boston Celtics", 2.3, 1.68),
          createBookmaker("DemoOdds", "Los Angeles Lakers", "Boston Celtics", 2.25, 1.7),
        ],
      },
      {
        id: "fallback-nba-2",
        sport_key: "basketball_nba",
        home_team: "Denver Nuggets",
        away_team: "Phoenix Suns",
        commence_time: new Date(now + 30 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          createBookmaker("SampleBook", "Denver Nuggets", "Phoenix Suns", 1.87, 2.0),
          createBookmaker("DemoOdds", "Denver Nuggets", "Phoenix Suns", 1.9, 1.96),
        ],
      },
    ],

    soccer_epl: [
      {
        id: "fallback-epl-1",
        sport_key: "soccer_epl",
        home_team: "Arsenal",
        away_team: "Liverpool",
        commence_time: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          createBookmaker("SampleBook", "Arsenal", "Liverpool", 2.45, 2.7, 3.4),
          createBookmaker("DemoOdds", "Arsenal", "Liverpool", 2.5, 2.62, 3.3),
        ],
      },
      {
        id: "fallback-epl-2",
        sport_key: "soccer_epl",
        home_team: "Manchester City",
        away_team: "Chelsea",
        commence_time: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
        bookmakers: [
          createBookmaker("SampleBook", "Manchester City", "Chelsea", 1.72, 4.4, 3.8),
          createBookmaker("DemoOdds", "Manchester City", "Chelsea", 1.75, 4.2, 3.75),
        ],
      },
    ],
  };

  return fallbackBySport[sport] || [];
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") || "icehockey_nhl";

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h&commenceTimeFrom=${encodeURIComponent(
        now.toISOString()
      )}&commenceTimeTo=${encodeURIComponent(threeDaysFromNow.toISOString())}`,
      {
        next: { revalidate: 60 },
      }
    );

    const data = await res.json();

    if (data?.error_code === "OUT_OF_USAGE_CREDITS") {
      return Response.json({
        error: "API quota exceeded",
        fallback: true,
        sport,
        data: getFallbackGames(sport),
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return Response.json({
        fallback: true,
        sport,
        data: getFallbackGames(sport),
      });
    }

    return Response.json({
      fallback: false,
      sport,
      data,
    });
  } catch (error) {
    return Response.json({
      error: "Failed to fetch odds",
      fallback: true,
      sport,
      data: getFallbackGames(sport),
    });
  }
}
