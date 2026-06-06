const BASE_URL = process.env.SPORTSDATA_BASE_URL || "https://api.sportsdata.io";
const API_KEY = process.env.SPORTSDATA_API_KEY;

export async function sportsDataGet(path) {
  if (!API_KEY) {
    return {
      ok: true,
      source: "sportsdata-placeholder",
      mode: "no_api_key",
      path,
      data: []
    };
  }

  const separator = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${separator}key=${API_KEY}`;

  try {
    const res = await fetch(url, {
      cache: "no-store"
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      return {
        ok: false,
        source: "sportsdata",
        mode: "api_error",
        status: res.status,
        path,
        error:
          typeof data === "string"
            ? data
            : data?.message || data?.Message || "SportsData API error",
        data: []
      };
    }

    return {
      ok: true,
      source: "sportsdata",
      mode: "live",
      status: res.status,
      path,
      data
    };
  } catch (error) {
    return {
      ok: false,
      source: "sportsdata",
      mode: "fetch_error",
      path,
      error: error.message,
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
