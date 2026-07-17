const BASE_URL = "https://api.sportsdata.io";

export async function sportsDataGet(path) {
  const apiKey = process.env.SPORTSDATA_API_KEY;
  const retrievedAt = new Date().toISOString();
  const safePath = String(path || "");

  if (!apiKey) {
    return {
      ok: true,
      source: "sportsdata-provider-not-configured",
      mode: "not_configured",
      path: safePath,
      retrievedAt,
      data: []
    };
  }

  if (!safePath.startsWith("/v3/") || safePath.includes("..") || safePath.length > 240) {
    return {
      ok: false,
      source: "sportsdata",
      mode: "invalid_path",
      path: safePath.slice(0, 240),
      retrievedAt,
      error: "Unsupported SportsData path",
      data: []
    };
  }

  const separator = safePath.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${safePath}${separator}key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        source: "sportsdata",
        mode: "api_error",
        status: response.status,
        path: safePath,
        retrievedAt,
        error: "SportsData provider request failed",
        data: []
      };
    }

    return {
      ok: true,
      source: "sportsdata",
      mode: "live",
      status: response.status,
      path: safePath,
      retrievedAt,
      data
    };
  } catch (error) {
    return {
      ok: false,
      source: "sportsdata",
      mode: "fetch_error",
      path: safePath,
      retrievedAt,
      error: error instanceof Error ? error.message : "SportsData request failed",
      data: []
    };
  }
}

export async function fetchSportsDataNFLStandings() {
  return sportsDataGet("/v3/nfl/scores/json/Standings/2025");
}

export async function fetchSportsDataNFLTeams() {
  return sportsDataGet("/v3/nfl/scores/json/Teams");
}

export async function fetchSportsDataNHLInjuries() {
  return sportsDataGet("/v3/nhl/scores/json/Injuries");
}

export async function fetchSportsDataNHLTeams() {
  return sportsDataGet("/v3/nhl/scores/json/Teams");
}

export async function fetchSportsDataNBATeams() {
  return sportsDataGet("/v3/nba/scores/json/Teams");
}
