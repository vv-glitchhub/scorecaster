function normalizeInjuryItem(item = {}) {
  return {
    name: item.name || item.player || "Unknown player",
    team: item.team || "unknown",
    status: item.status || "unknown",
    injury: item.injury || item.reason || null,
    importance: Number(item.importance || 1),
    source: item.source || "unknown",
    sourceType: item.sourceType || "unknown",
    sourceTrust: item.sourceTrust ?? 0.5,
    updatedAt: item.updatedAt || item.date || null
  };
}

export async function fetchInjuriesForMatch({ homeTeam, awayTeam, sport, league }) {
  const apiKey = process.env.SPORTS_INJURY_API_KEY;

  if (!apiKey) {
    return {
      ok: true,
      source: "placeholder-injury-fetcher",
      mode: "no_api_key",
      teams: [homeTeam, awayTeam],
      data: []
    };
  }

  // Placeholder endpoint. Replace this with the provider you choose later.
  const url = `https://example.com/injuries?home=${encodeURIComponent(
    homeTeam
  )}&away=${encodeURIComponent(awayTeam)}&sport=${encodeURIComponent(
    sport || ""
  )}&league=${encodeURIComponent(league || "")}&apiKey=${apiKey}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        source: "sports-injury-api",
        mode: "api_error",
        error: data?.message || "Injury API error",
        data: []
      };
    }

    return {
      ok: true,
      source: "sports-injury-api",
      mode: "live",
      teams: [homeTeam, awayTeam],
      data: (data.players || data.data || []).map(normalizeInjuryItem)
    };
  } catch (error) {
    return {
      ok: false,
      source: "sports-injury-api",
      mode: "fetch_error",
      error: error.message,
      data: []
    };
  }
}
