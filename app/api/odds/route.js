export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const sport = searchParams.get("sport") || "icehockey_nhl";
  const markets = searchParams.get("markets") || "h2h";
  const regions = searchParams.get("regions") || "eu";
  const oddsFormat = searchParams.get("oddsFormat") || "decimal";

  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        source: "error",
        reason: "Missing ODDS_API_KEY environment variable",
        data: []
      },
      { status: 500 }
    );
  }

  try {
    const url = new URL(
      `https://api.the-odds-api.com/v4/sports/${sport}/odds`
    );

    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", regions);
    url.searchParams.set("markets", markets);
    url.searchParams.set("oddsFormat", oddsFormat);

    const response = await fetch(url.toString(), {
      next: { revalidate: 60 }
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          source: "api_error",
          reason: data?.message || "The Odds API request failed",
          status: response.status,
          data: []
        },
        { status: response.status }
      );
    }

    return Response.json({
      ok: true,
      source: "live",
      sport,
      markets,
      regions,
      count: Array.isArray(data) ? data.length : 0,
      data
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "error",
        reason: error.message,
        data: []
      },
      { status: 500 }
    );
  }
}
