function getFallbackGames(sport) {
  const fallbackBySport = {
    icehockey_nhl: [
      {
        id: "fallback-nhl-1",
        sport_key: "icehockey_nhl",
        home_team: "Tappara",
        away_team: "Ilves",
        commence_time: new Date().toISOString(),
        bookmakers: [],
      },
    ],
    basketball_nba: [
      {
        id: "fallback-nba-1",
        sport_key: "basketball_nba",
        home_team: "Lakers",
        away_team: "Celtics",
        commence_time: new Date().toISOString(),
        bookmakers: [],
      },
    ],
    soccer_epl: [
      {
        id: "fallback-epl-1",
        sport_key: "soccer_epl",
        home_team: "Arsenal",
        away_team: "Liverpool",
        commence_time: new Date().toISOString(),
        bookmakers: [],
      },
    ],
  };

  return fallbackBySport[sport] || [];
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") || "icehockey_nhl";

  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h`,
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
