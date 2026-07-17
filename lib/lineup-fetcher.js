function normalizeLineup(data = {}) {
  return {
    startersConfirmed: Boolean(data.startersConfirmed),
    goalieConfirmed: Boolean(data.goalieConfirmed),
    keyPlayersAvailable: data.keyPlayersAvailable !== false,
    lineupStability: Number(data.lineupStability || 0),
    source: data.source || "unknown",
    sourceType: data.sourceType || "unknown",
    sourceTrust: data.sourceTrust ?? 0.5,
    updatedAt: data.updatedAt || data.confirmedAt || null
  };
}

function configuredProvider() {
  const baseUrl = String(process.env.LINEUP_API_URL || "").trim();
  const apiKey = String(process.env.LINEUP_API_KEY || "").trim();
  if (!baseUrl || !apiKey) return null;

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:") return null;
    return { url, apiKey };
  } catch {
    return null;
  }
}

export async function fetchLineupForMatch({ homeTeam, awayTeam, sport, league }) {
  const provider = configuredProvider();

  if (!provider) {
    return {
      ok: true,
      source: "lineup-provider",
      mode: "not_configured",
      teams: [homeTeam, awayTeam],
      data: normalizeLineup({})
    };
  }

  const url = new URL(provider.url);
  url.searchParams.set("home", String(homeTeam || ""));
  url.searchParams.set("away", String(awayTeam || ""));
  url.searchParams.set("sport", String(sport || ""));
  url.searchParams.set("league", String(league || ""));

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        Accept: "application/json"
      }
    });
    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        source: "lineup-provider",
        mode: "api_error",
        status: res.status,
        data: normalizeLineup({})
      };
    }

    return {
      ok: true,
      source: "lineup-provider",
      mode: "live",
      teams: [homeTeam, awayTeam],
      data: normalizeLineup(data.lineup || data.data || data)
    };
  } catch {
    return {
      ok: false,
      source: "lineup-provider",
      mode: "fetch_error",
      data: normalizeLineup({})
    };
  }
}
