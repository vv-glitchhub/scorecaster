const BASE_URL = process.env.SPORTSDATA_BASE_URL || "https://api.sportsdata.io";
const API_KEY = process.env.SPORTSDATA_API_KEY;

async function sportsDataGet(path) {
  if (!API_KEY) {
    return {
      ok: true,
      source: "sportsdata-placeholder",
      mode: "no_api_key",
      data: []
    };
  }

  const url = `${BASE_URL}${path}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "Ocp-Apim-Subscription-Key": API_KEY
      }
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        source: "sportsdata",
        mode: "api_error",
        status: res.status,
        error: data?.message || "SportsData API error",
        data: []
      };
    }

    return {
      ok: true,
      source: "sportsdata",
      mode: "live",
      data
    };
  } catch (error) {
    return {
      ok: false,
      source: "sportsdata",
      mode: "fetch_error",
      error: error.message,
      data: []
    };
  }
}

export async function fetchSportsDataNHLInjuries() {
  return sportsDataGet("/v3/nhl/scores/json/Injuries");
}

export async function fetchSportsDataNBANews() {
  return sportsDataGet("/v3/nba/scores/json/News");
}

export async function fetchSportsDataNFLInjuries() {
  return sportsDataGet("/v3/nfl/scores/json/Injuries");
}

export async function fetchSportsDataTeamsNHL() {
  return sportsDataGet("/v3/nhl/scores/json/Teams");
}
