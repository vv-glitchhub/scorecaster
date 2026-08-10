const OUTDOOR_MARKERS = ["soccer", "football", "baseball", "mlb", "nfl", "tennis", "golf", "cricket", "rugby"];
const LOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LOCATION_CACHE_LIMIT = 300;
const LOCATION_CACHE_KEY = "__scorecasterWeatherLocationCacheV1";

function locationCache() {
  if (!globalThis[LOCATION_CACHE_KEY]) globalThis[LOCATION_CACHE_KEY] = new Map();
  return globalThis[LOCATION_CACHE_KEY];
}

function clean(value, limit = 160) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeKey(value) {
  return clean(value, 160).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function directCoordinates(match = {}) {
  const directLat = finite(match.latitude ?? match.venueLatitude ?? match.venue?.latitude);
  const directLon = finite(match.longitude ?? match.venueLongitude ?? match.venue?.longitude);
  if (directLat !== null && directLon !== null) {
    return { latitude: directLat, longitude: directLon, source: "event-metadata", locationLabel: clean(match.venue?.name || match.venue || match.stadium, 180) || null };
  }

  try {
    const map = JSON.parse(process.env.VENUE_COORDINATES_JSON || "{}");
    const candidates = [match.venue?.name || match.venue, match.homeTeam, match.stadium].map(normalizeKey).filter(Boolean);
    for (const candidate of candidates) {
      const row = map[candidate] || map[match.venue] || map[match.homeTeam];
      const latitude = finite(row?.latitude ?? row?.lat);
      const longitude = finite(row?.longitude ?? row?.lon ?? row?.lng);
      if (latitude !== null && longitude !== null) {
        return {
          latitude,
          longitude,
          source: "configured-venue-map",
          locationLabel: clean(row?.name || row?.venue || match.venue?.name || match.venue || match.homeTeam, 180) || null
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function cacheRead(key, now = Date.now()) {
  const row = locationCache().get(key);
  if (!row) return undefined;
  if (now - row.storedAt > LOCATION_CACHE_TTL_MS) {
    locationCache().delete(key);
    return undefined;
  }
  return row.value;
}

function cacheWrite(key, value, now = Date.now()) {
  const store = locationCache();
  if (store.size >= LOCATION_CACHE_LIMIT) {
    [...store.entries()]
      .sort((left, right) => left[1].storedAt - right[1].storedAt)
      .slice(0, 30)
      .forEach(([entryKey]) => store.delete(entryKey));
  }
  store.set(key, { storedAt: now, value });
}

function teamMatches(row = {}, requestedTeam = "") {
  const requested = normalizeKey(requestedTeam);
  const primary = normalizeKey(row.strTeam);
  const alternates = clean(row.strTeamAlternate, 300)
    .split(",")
    .map(normalizeKey)
    .filter(Boolean);
  if (!requested || !primary) return false;
  if (requested === primary || alternates.includes(requested)) return true;
  return requested.length >= 5 && primary.length >= 5 && (requested.includes(primary) || primary.includes(requested));
}

async function geocodeLocation(label) {
  const query = clean(label, 180);
  if (!query) return null;
  const cacheKey = `geocode:${normalizeKey(query)}`;
  const cached = cacheRead(cacheKey);
  if (cached !== undefined) return cached;

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" }
    });
    const payload = await response.json().catch(() => null);
    const rows = Array.isArray(payload?.results) ? payload.results : [];
    const row = rows.find((candidate) => finite(candidate?.latitude) !== null && finite(candidate?.longitude) !== null) || null;
    const coordinates = row
      ? {
          latitude: finite(row.latitude),
          longitude: finite(row.longitude),
          source: "open-meteo-geocoding",
          locationLabel: [row.name, row.admin1, row.country].map((value) => clean(value, 100)).filter(Boolean).join(", ") || query
        }
      : null;
    cacheWrite(cacheKey, coordinates);
    return coordinates;
  } catch {
    return null;
  }
}

async function homeTeamLocation(match = {}) {
  const homeTeam = clean(match.homeTeam, 140);
  if (!homeTeam) return null;
  const cacheKey = `team:${normalizeKey(homeTeam)}`;
  const cached = cacheRead(cacheKey);
  if (cached !== undefined) return cached;

  const apiKey = clean(process.env.THESPORTSDB_API_KEY || "123", 80);
  const url = new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/searchteams.php`);
  url.searchParams.set("t", homeTeam);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json" }
    });
    const payload = await response.json().catch(() => null);
    const teams = Array.isArray(payload?.teams) ? payload.teams : [];
    const row = teams.find((candidate) => teamMatches(candidate, homeTeam)) || null;
    if (!response.ok || !row) {
      cacheWrite(cacheKey, null);
      return null;
    }

    const location = clean(row.strLocation, 160);
    const stadium = clean(row.strStadium, 160);
    const country = clean(row.strCountry, 100);
    const candidates = [
      stadium && location ? `${stadium}, ${location}` : stadium,
      location && country ? `${location}, ${country}` : location
    ].filter(Boolean);

    const result = { location, stadium, country, candidates };
    cacheWrite(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

async function resolvedCoordinates(match = {}) {
  const direct = directCoordinates(match);
  if (direct) return direct;

  const venueLabel = clean(match.venue?.name || match.venue || match.stadium, 180);
  if (venueLabel) {
    const venueCoordinates = await geocodeLocation(venueLabel);
    if (venueCoordinates) return { ...venueCoordinates, source: "open-meteo-venue-geocoding" };
  }

  const teamLocation = await homeTeamLocation(match);
  for (const candidate of teamLocation?.candidates || []) {
    const coordinates = await geocodeLocation(candidate);
    if (coordinates) {
      return {
        ...coordinates,
        source: "thesportsdb-team-location+open-meteo-geocoding",
        venueName: teamLocation.stadium || null
      };
    }
  }
  return null;
}

export function isOutdoorSport(match = {}) {
  if (match.indoor === true) return false;
  if (match.outdoor === true) return true;
  const value = `${match.sportKey || ""} ${match.sport || ""} ${match.league || ""}`.toLowerCase();
  return OUTDOOR_MARKERS.some((marker) => value.includes(marker));
}

function nearestHourlyIndex(times = [], target) {
  let best = -1;
  let distance = Infinity;
  times.forEach((time, index) => {
    const parsed = Date.parse(time);
    if (!Number.isFinite(parsed)) return;
    const nextDistance = Math.abs(parsed - target);
    if (nextDistance < distance) {
      best = index;
      distance = nextDistance;
    }
  });
  return best;
}

function weatherImpact({ precipitationProbability, precipitation, windSpeed, windGusts, temperature }) {
  let severity = 0;
  const reasons = [];
  if (precipitationProbability >= 70 || precipitation >= 4) {
    severity += 0.45;
    reasons.push("heavy precipitation risk");
  } else if (precipitationProbability >= 40 || precipitation >= 1) {
    severity += 0.2;
    reasons.push("meaningful precipitation risk");
  }
  if (windSpeed >= 35 || windGusts >= 55) {
    severity += 0.45;
    reasons.push("strong wind");
  } else if (windSpeed >= 22 || windGusts >= 38) {
    severity += 0.2;
    reasons.push("moderate wind");
  }
  if (temperature <= -8 || temperature >= 34) {
    severity += 0.25;
    reasons.push("extreme temperature");
  }
  severity = Math.min(1, severity);
  return {
    severity,
    impact: Number((-severity * 0.012).toFixed(4)),
    reasons
  };
}

export async function fetchWeatherForMatch(match = {}) {
  const retrievedAt = new Date().toISOString();
  if (!isOutdoorSport(match)) {
    return { ok: true, source: "open-meteo", mode: "not_applicable_indoor", retrievedAt, data: null };
  }
  const commence = Date.parse(match.commenceTime || match.commence_time || "");
  if (!Number.isFinite(commence)) {
    return { ok: true, source: "open-meteo", mode: "missing_commence_time", retrievedAt, data: null };
  }

  const coordinates = await resolvedCoordinates(match);
  if (!coordinates) {
    return { ok: true, source: "open-meteo", mode: "missing_coordinates", retrievedAt, data: null };
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(coordinates.latitude));
  url.searchParams.set("longitude", String(coordinates.longitude));
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m");
  url.searchParams.set("forecast_days", "16");
  url.searchParams.set("timezone", "UTC");

  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7000), headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) {
      return { ok: false, source: "open-meteo", mode: "api_error", status: response.status, retrievedAt, data: null };
    }
    const index = nearestHourlyIndex(payload?.hourly?.time || [], commence);
    if (index < 0) {
      return { ok: true, source: "open-meteo", mode: "forecast_out_of_range", retrievedAt, data: null };
    }
    const data = {
      forecastTime: payload.hourly.time[index],
      temperatureC: finite(payload.hourly.temperature_2m?.[index]),
      precipitationProbability: finite(payload.hourly.precipitation_probability?.[index]),
      precipitationMm: finite(payload.hourly.precipitation?.[index]),
      weatherCode: finite(payload.hourly.weather_code?.[index]),
      windSpeedKmh: finite(payload.hourly.wind_speed_10m?.[index]),
      windGustsKmh: finite(payload.hourly.wind_gusts_10m?.[index]),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      coordinateSource: coordinates.source,
      locationLabel: coordinates.locationLabel || null,
      venueName: coordinates.venueName || null,
      attribution: "Weather data by Open-Meteo; team/venue metadata may be resolved through TheSportsDB"
    };
    const effect = weatherImpact({
      precipitationProbability: data.precipitationProbability || 0,
      precipitation: data.precipitationMm || 0,
      windSpeed: data.windSpeedKmh || 0,
      windGusts: data.windGustsKmh || 0,
      temperature: data.temperatureC || 0
    });
    return { ok: true, source: "open-meteo", mode: "live", retrievedAt, data: { ...data, ...effect } };
  } catch (error) {
    return {
      ok: false,
      source: "open-meteo",
      mode: error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "fetch_error",
      retrievedAt,
      data: null
    };
  }
}

export function resetOpenMeteoLocationCacheForTests() {
  locationCache().clear();
}
