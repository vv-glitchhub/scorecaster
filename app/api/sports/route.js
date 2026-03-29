function getFallbackSports() {
  return [
    {
      key: "icehockey_nhl",
      group: "Ice Hockey",
      title: "NHL",
      description: "National Hockey League",
      active: true,
      has_outrights: false,
    },
    {
      key: "icehockey_liiga",
      group: "Ice Hockey",
      title: "Liiga",
      description: "Finnish Liiga",
      active: true,
      has_outrights: false,
    },
    {
      key: "basketball_nba",
      group: "Basketball",
      title: "NBA",
      description: "National Basketball Association",
      active: true,
      has_outrights: false,
    },
    {
      key: "soccer_epl",
      group: "Soccer",
      title: "Premier League",
      description: "English Premier League",
      active: true,
      has_outrights: false,
    },
  ];
}

function isAllowedSport(sport) {
  if (!sport?.active) return false;

  const blockedGroups = ["Politics", "Awards", "Entertainment"];
  if (blockedGroups.includes(sport.group)) return false;

  const allowedGroups = ["Ice Hockey", "Basketball", "Soccer"];
  if (!allowedGroups.includes(sport.group)) return false;

  return true;
}

export async function GET() {
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${process.env.ODDS_API_KEY}`,
      {
        next: { revalidate: 60 * 60 * 24 * 3 },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return Response.json({
        fallback: true,
        data: getFallbackSports(),
        error: data?.message || "Failed to fetch sports",
      });
    }

    const filtered = Array.isArray(data)
      ? data.filter(isAllowedSport)
      : [];

    return Response.json({
      fallback: false,
      data: filtered,
    });
  } catch (error) {
    return Response.json({
      fallback: true,
      data: getFallbackSports(),
      error: "Failed to fetch sports",
    });
  }
}
