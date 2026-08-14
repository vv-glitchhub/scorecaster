const BASE_URL = process.env.SPORTSDATA_BASE_URL || "https://api.sportsdata.io";
const API_KEY = process.env.SPORTSDATA_API_KEY;
const REQUEST_TIMEOUT_MS = 12_000;

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

  const url = `${BASE_URL}${path}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "Ocp-Apim-Subscription-Key": API_KEY,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
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
        mode: res.status === 401 || res.status === 403 ? "subscription_unavailable" : "api_error",
        status: res.status,
        path,
        error:
          typeof data === "string"
            ? data.slice(0, 240)
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
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      ok: false,
      source: "sportsdata",
      mode: timeout ? "timeout" : "fetch_error",
      path,
      error: timeout ? "SportsData API request timed out" : String(error?.message || "SportsData API fetch failed").slice(0, 240),
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

export const SPORTSDATA_FETCH_POLICY = Object.freeze({
  authTransport: "subscription-header",
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  apiKeyInUrl: false
});
