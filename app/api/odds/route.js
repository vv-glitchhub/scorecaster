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
      return Response.json(
        {
          error: "API quota exceeded",
          fallback: true,
          data: [
            {
              id: "fallback-1",
              home_team: "Tappara",
              away_team: "Ilves",
              bookmakers: [],
            },
          ],
        },
        { status: 200 }
      );
    }

    return Response.json(
      {
        fallback: false,
        data,
      },
      { status: res.status }
    );
  } catch (error) {
    return Response.json(
      {
        error: "Failed to fetch odds",
        fallback: true,
        data: [
          {
            id: "fallback-1",
            home_team: "Tappara",
            away_team: "Ilves",
            bookmakers: [],
          },
        ],
      },
      { status: 200 }
    );
  }
}
