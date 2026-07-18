import { getSportsDbLeagueId } from "./results-league-map.js";
import { normalizeSportsDbEvents } from "./results-normalizer.js";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 80;
const RESULT_LIMIT = 120;
const cache = new Map();

const SPORTSDB_KEY_BY_SPORT = Object.freeze({
  icehockey_nhl: "NHL",
  basketball_nba: "NBA",
  soccer_epl: "EPL",
  soccer_spain_la_liga: "LALIGA"
});

function clean(value, limit = 120) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cacheKey(leagueKey) {
  return clean(leagueKey, 40).toUpperCase();
}

function pruneCache() {
  if (cache.size < CACHE_LIMIT) return;
  const oldest = [...cache.entries()]
    .sort((left, right) => left[1].storedAt - right[1].storedAt)
    .slice(0, Math.max(1, Math.floor(CACHE_LIMIT / 5)));
  oldest.forEach(([key]) => cache.delete(key));
}

export function resolveSportsDbLeagueKey({ sportKey, league } = {}) {
  const direct = SPORTSDB_KEY_BY_SPORT[clean(sportKey, 120)];
  if (direct) return direct;

  const normalized = clean(league, 80).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (["NHL", "NBA", "EPL", "LALIGA"].includes(normalized)) return normalized;
  if (normalized.includes("PREMIERLEAGUE")) return "EPL";
  if (normalized.includes("LALIGA")) return "LALIGA";
  return null;
}

export async function fetchRecentLeagueResults({ sportKey, league, now = Date.now() } = {}) {
  const leagueKey = resolveSportsDbLeagueKey({ sportKey, league });
  if (!leagueKey) {
    return {
      ok: true,
      source: "thesportsdb",
      mode: "unsupported_league",
      leagueKey: null,
      retrievedAt: new Date(now).toISOString(),
      results: []
    };
  }

  const key = cacheKey(leagueKey);
  const cached = cache.get(key);
  if (cached && now - cached.storedAt <= CACHE_TTL_MS) {
    return {
      ...cached.payload,
      cached: true,
      cacheAgeSeconds: Math.max(0, Math.round((now - cached.storedAt) / 1000))
    };
  }

  const leagueId = getSportsDbLeagueId(leagueKey);
  if (!leagueId) {
    return {
      ok: true,
      source: "thesportsdb",
      mode: "unsupported_league",
      leagueKey,
      retrievedAt: new Date(now).toISOString(),
      results: []
    };
  }

  const apiKey = clean(process.env.THESPORTSDB_API_KEY || "3", 80);
  const url = new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/eventspastleague.php`);
  url.searchParams.set("id", leagueId);

  try {
    const response = await fetch(url, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(10000)
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!response.ok || !json) {
      return {
        ok: false,
        source: "thesportsdb",
        mode: "provider_error",
        leagueKey,
        status: response.status,
        retrievedAt: new Date(now).toISOString(),
        error: "Results provider request failed",
        results: []
      };
    }

    const rawEvents = Array.isArray(json.events) ? json.events.slice(0, RESULT_LIMIT) : [];
    const results = normalizeSportsDbEvents(rawEvents).slice(0, RESULT_LIMIT);
    const payload = {
      ok: true,
      source: "thesportsdb",
      mode: "live",
      leagueKey,
      leagueId,
      retrievedAt: new Date(now).toISOString(),
      rawCount: rawEvents.length,
      resultCount: results.length,
      results,
      cached: false,
      cacheAgeSeconds: 0
    };

    pruneCache();
    cache.set(key, { storedAt: now, payload });
    return payload;
  } catch {
    return {
      ok: false,
      source: "thesportsdb",
      mode: "timeout",
      leagueKey,
      retrievedAt: new Date(now).toISOString(),
      error: "Results provider timed out",
      results: []
    };
  }
}

export const RESULTS_PROVIDER_POLICY = Object.freeze({
  cacheTtlMinutes: CACHE_TTL_MS / 60000,
  maximumResultsPerLeague: RESULT_LIMIT,
  supportedSportKeys: Object.keys(SPORTSDB_KEY_BY_SPORT)
});
