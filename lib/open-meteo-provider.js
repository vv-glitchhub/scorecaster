const OUTDOOR_MARKERS = ["soccer", "football", "baseball", "mlb", "nfl", "tennis", "golf", "cricket", "rugby"];

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

function configuredCoordinates(match = {}) {
  const directLat = finite(match.latitude ?? match.venueLatitude ?? match.venue?.latitude);
  const directLon = finite(match.longitude ?? match.venueLongitude ?? match.venue?.longitude);
  if (directLat !== null && directLon !== null) return { latitude: directLat, longitude: directLon, source: "event-metadata" };

  try {
    const map = JSON.parse(process.env.VENUE_COORDINATES_JSON || "{}");
    const candidates = [match.venue, match.homeTeam, match.stadium].map(normalizeKey).filter(Boolean);
    for (const candidate of candidates) {
      const row = map[candidate] || map[match.venue] || map[match.homeTeam];
      const latitude = finite(row?.latitude ?? row?.lat);
      const longitude = finite(row?.longitude ?? row?.lon ?? row?.lng);
      if (latitude !== null && longitude !== null) return { latitude, longitude, source: "configured-venue-map" };
    }
  } catch {
    return null;
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
  const coordinates = configuredCoordinates(match);
  if (!coordinates) {
    return { ok: true, source: "open-meteo", mode: "missing_coordinates", retrievedAt, data: null };
  }

  const commence = Date.parse(match.commenceTime || match.commence_time || "");
  if (!Number.isFinite(commence)) {
    return { ok: true, source: "open-meteo", mode: "missing_commence_time", retrievedAt, data: null };
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
      attribution: "Weather data by Open-Meteo"
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
