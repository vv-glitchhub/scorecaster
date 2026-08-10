import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchWeatherForMatch,
  resetOpenMeteoLocationCacheForTests
} from "../lib/open-meteo-provider.js";

const originalFetch = globalThis.fetch;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetOpenMeteoLocationCacheForTests();
});

test("outdoor fixture resolves home-team location before requesting weather", async () => {
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);

    if (url.hostname === "www.thesportsdb.com") {
      return jsonResponse({
        teams: [{
          strTeam: "Arsenal",
          strTeamAlternate: "Arsenal FC",
          strSport: "Soccer",
          strStadium: "Emirates Stadium",
          strLocation: "Holloway, London, England",
          strCountry: "England"
        }]
      });
    }

    if (url.hostname === "geocoding-api.open-meteo.com") {
      return jsonResponse({
        results: [{
          name: "London",
          admin1: "England",
          country: "United Kingdom",
          latitude: 51.5074,
          longitude: -0.1278
        }]
      });
    }

    if (url.hostname === "api.open-meteo.com") {
      return jsonResponse({
        hourly: {
          time: ["2026-08-12T18:00"],
          temperature_2m: [22],
          precipitation_probability: [35],
          precipitation: [0.2],
          weather_code: [2],
          wind_speed_10m: [12],
          wind_gusts_10m: [24]
        }
      });
    }

    throw new Error(`Unexpected host: ${url.hostname}`);
  };

  const result = await fetchWeatherForMatch({
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    sportKey: "soccer_epl",
    commenceTime: "2026-08-12T18:00:00Z"
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "live");
  assert.equal(result.data.coordinateSource, "thesportsdb-team-location+open-meteo-geocoding");
  assert.equal(result.data.latitude, 51.5074);
  assert.equal(result.data.longitude, -0.1278);
  assert.equal(result.data.venueName, "Emirates Stadium");
  assert.equal(calls.filter((url) => url.hostname === "www.thesportsdb.com").length, 1);
  assert.equal(calls.filter((url) => url.hostname === "geocoding-api.open-meteo.com").length, 1);
  assert.equal(calls.filter((url) => url.hostname === "api.open-meteo.com").length, 1);
});

test("direct event coordinates bypass team and geocoding lookups", async () => {
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    assert.equal(url.hostname, "api.open-meteo.com");
    return jsonResponse({
      hourly: {
        time: ["2026-08-12T18:00"],
        temperature_2m: [18],
        precipitation_probability: [10],
        precipitation: [0],
        weather_code: [1],
        wind_speed_10m: [8],
        wind_gusts_10m: [14]
      }
    });
  };

  const result = await fetchWeatherForMatch({
    homeTeam: "Home",
    awayTeam: "Away",
    sportKey: "soccer_epl",
    commenceTime: "2026-08-12T18:00:00Z",
    latitude: 60.1699,
    longitude: 24.9384
  });

  assert.equal(result.mode, "live");
  assert.equal(result.data.coordinateSource, "event-metadata");
  assert.equal(calls.length, 1);
});

test("indoor fixture remains not applicable without network calls", async () => {
  globalThis.fetch = async () => {
    throw new Error("indoor weather must not access network");
  };

  const result = await fetchWeatherForMatch({
    homeTeam: "Minnesota Lynx",
    awayTeam: "Seattle Storm",
    sportKey: "basketball_wnba",
    commenceTime: "2026-08-12T18:00:00Z"
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "not_applicable_indoor");
});

test("team mismatch fails closed instead of geocoding an unrelated venue", async () => {
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls += 1;
    const url = new URL(String(input));
    assert.equal(url.hostname, "www.thesportsdb.com");
    return jsonResponse({
      teams: [{
        strTeam: "Tottenham Hotspur",
        strStadium: "Tottenham Hotspur Stadium",
        strLocation: "London, England",
        strCountry: "England"
      }]
    });
  };

  const result = await fetchWeatherForMatch({
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    sportKey: "soccer_epl",
    commenceTime: "2026-08-12T18:00:00Z"
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "missing_coordinates");
  assert.equal(calls, 1);
});
