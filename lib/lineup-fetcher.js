function normalizeLineup(data = {}) {
  return {
    startersConfirmed: Boolean(data.startersConfirmed),
    goalieConfirmed: Boolean(data.goalieConfirmed),
    keyPlayersAvailable: data.keyPlayersAvailable !== false,
    lineupStability: Number(data.lineupStability || 0),
    source: data.source || "unknown",
    sourceType: data.sourceType || "unknown",
    sourceTrust: data.sourceTrust ?? 0.5,
    updatedAt: data.updatedAt || null
  };
}

export async function fetchLineupForMatch({ homeTeam, awayTeam, sport, league }) {
  const apiKey = process.env.LINEUP_API_KEY;

  if (!apiKey) {
    return {
      ok: true,
      source: "placeholder-lineup-fetcher",
      mode: "no_api_key",
      teams: [homeTeam, awayTeam],
      data: normalizeLineup({})
    };
  }

  const url = `https://example.com/lineups?home=${encodeURIComponent(
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
        source: "lineup-api",
        mode: "api_error",
        error: data?.message || "Lineup API error",
        data: normalizeLineup({})
      };
    }

    return {
      ok: true,
      source: "lineup-api",
      mode: "live",
      teams: [homeTeam, awayTeam],
      data: normalizeLineup(data.lineup || data.data || data)
    };
  } catch (error) {
    return {
      ok: false,
      source: "lineup-api",
      mode: "fetch_error",
      error: error.message,
      data: normalizeLineup({})
    };
  }
}
