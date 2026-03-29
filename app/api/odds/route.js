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

    if (!process.env.ODDS_API_KEY) {
      return Response.json({
        fallback: false,
        reason: "missing_api_key",
        sport,
        data: [],
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
        fallback: false,
        reason: "api_error",
        sport,
        data: [],
        error: data,
      });
    }

    const filtered = filterUpcomingGames(data);

    return Response.json({
      fallback: false,
      reason: filtered.length ? null : "empty_live_data",
      sport,
      data: filtered,
    });
  } catch (error) {
    return Response.json({
      fallback: false,
      reason: "server_error",
      sport: null,
      data: [],
      error: String(error),
    });
  }
}
