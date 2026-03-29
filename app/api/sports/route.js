function getFallbackSports() {
  return [
    {
      key: "icehockey_nhl",
      group: "Ice Hockey",
      title: "NHL",
      description: "National Hockey League",
      active: true,
      has_outrights: false
    },
    {
      key: "basketball_nba",
      group: "Basketball",
      title: "NBA",
      description: "National Basketball Association",
      active: true,
      has_outrights: false
    },
    {
      key: "soccer_epl",
      group: "Soccer",
      title: "EPL",
      description: "English Premier League",
      active: true,
      has_outrights: false
    }
  ];
}

export async function GET() {
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${process.env.ODDS_API_KEY}`,
      {
        next: { revalidate: 3600 }
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return Response.json({
        fallback: true,
        data: getFallbackSports(),
        error: data?.message || "Failed to fetch sports"
      });
    }

    const filtered = Array.isArray(data)
      ? data.filter((sport) => sport.active)
      : [];

    return Response.json({
      fallback: false,
      data: filtered
    });
  } catch (error) {
    return Response.json({
      fallback: true,
      data: getFallbackSports(),
      error: "Failed to fetch sports"
    });
  }
}
