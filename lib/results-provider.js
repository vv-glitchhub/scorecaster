import { getSportsDbLeagueId } from "./results-league-map.js";
import { namesMatch, normalizeSportsDbEvents } from "./results-normalizer.js";
import {
  fetchSportsDbTeamHistory,
  mergeTeamHistoryResults,
  teamCompletedSampleCount
} from "./thesportsdb-team-history-v1.mjs";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 80;
const RESULT_LIMIT = 500;
const RECENT_RESULT_LIMIT = 120;
const SEASON_DEPTH_MIN_RESULTS = 30;
const TEAM_DEPTH_MIN_RESULTS = 3;
const cache = new Map();

const SPORTSDB_KEY_BY_SPORT = Object.freeze({
  icehockey_nhl: "NHL",
  basketball_nba: "NBA",
  basketball_wnba: "WNBA",
  baseball_mlb: "MLB",
  soccer_epl: "EPL",
  soccer_spain_la_liga: "LALIGA",
  soccer_usa_mls: "MLS",
  soccer_finland_veikkausliiga: "VEIKKAUSLIIGA",
  soccer_sweden_allsvenskan: "ALLSVENSKAN",
  soccer_norway_eliteserien: "ELITESERIEN"
});

const SPORTSDB_KEYS = new Set(Object.values(SPORTSDB_KEY_BY_SPORT));
const CALENDAR_YEAR_SEASONS = new Set([
  "basketball_wnba",
  "baseball_mlb",
  "soccer_usa_mls",
  "soccer_finland_veikkausliiga",
  "soccer_sweden_allsvenskan",
  "soccer_norway_eliteserien"
]);

function clean(value, limit = 120) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cacheKey(leagueKey, season) {
  return `${clean(leagueKey, 40).toUpperCase()}:${clean(season || "current", 20)}`;
}

function pruneCache() {
  if (cache.size < CACHE_LIMIT) return;
  const oldest = [...cache.entries()]
    .sort((left, right) => left[1].storedAt - right[1].storedAt)
    .slice(0, Math.max(1, Math.floor(CACHE_LIMIT / 5)));
  oldest.forEach(([key]) => cache.delete(key));
}

function seasonForSport(sportKey, now) {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  if (CALENDAR_YEAR_SEASONS.has(clean(sportKey, 120))) return String(year);
  const startsInSecondHalf = date.getUTCMonth() >= 6;
  const startYear = startsInSecondHalf ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function mergeEvents(...collections) {
  const byId = new Map();
  for (const events of collections) {
    for (const event of Array.isArray(events) ? events : []) {
      const key = clean(event.id || `${event.date}:${event.home_team}:${event.away_team}`, 240);
      if (!key || byId.has(key)) continue;
      byId.set(key, event);
    }
  }
  return [...byId.values()].slice(0, RESULT_LIMIT);
}

async function fetchSportsDbEvents(url, { fetchImpl = fetch, headers } = {}) {
  try {
    const response = await fetchImpl(url, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(10000),
      ...(headers ? { headers } : {})
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
        status: response.status,
        error: "Results provider request failed",
        rawEvents: [],
        results: []
      };
    }

    const rawEvents = Array.isArray(json.events) ? json.events.slice(0, RESULT_LIMIT) : [];
    return {
      ok: true,
      status: response.status,
      rawEvents,
      results: normalizeSportsDbEvents(rawEvents).slice(0, RESULT_LIMIT)
    };
  } catch {
    return {
      ok: false,
      status: null,
      error: "Results provider timed out",
      rawEvents: [],
      results: []
    };
  }
}

export function resolveSportsDbLeagueKey({ sportKey, league } = {}) {
  const direct = SPORTSDB_KEY_BY_SPORT[clean(sportKey, 120)];
  if (direct) return direct;

  const normalized = clean(league, 80).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (SPORTSDB_KEYS.has(normalized)) return normalized;
  if (normalized.includes("PREMIERLEAGUE")) return "EPL";
  if (normalized.includes("LALIGA")) return "LALIGA";
  if (normalized === "MAJORLEAGUESOCCER" || normalized === "AMERICANMAJORLEAGUESOCCER") return "MLS";
  if (normalized.includes("VEIKKAUSLIIGA")) return "VEIKKAUSLIIGA";
  if (normalized.includes("ALLSVENSKAN")) return "ALLSVENSKAN";
  if (normalized.includes("ELITESERIEN")) return "ELITESERIEN";
  return null;
}

function teamSampleCount(results, team, cutoff) {
  if (!team) return 0;
  return teamCompletedSampleCount(results, team, cutoff);
}

function safeTeamDepthRow(team, before, after, provider = null) {
  return {
    team: clean(team, 120),
    before,
    after,
    added: Math.max(0, after - before),
    requested: before < TEAM_DEPTH_MIN_RESULTS,
    mode: provider?.mode || (before >= TEAM_DEPTH_MIN_RESULTS ? "league-history-sufficient" : "not_attempted"),
    source: provider?.source || null,
    teamIdSource: provider?.teamIdSource || null,
    cached: provider?.cached === true
  };
}

async function enrichWithTeamHistory(basePayload, {
  homeTeam,
  awayTeam,
  commenceTime,
  now,
  fetchTeamHistory = fetchSportsDbTeamHistory
} = {}) {
  if (!homeTeam || !awayTeam) {
    return {
      ...basePayload,
      teamDepth: {
        attempted: false,
        reason: "match-teams-unavailable",
        minimumResultsPerTeam: TEAM_DEPTH_MIN_RESULTS,
        rows: []
      }
    };
  }

  const cutoffParsed = Date.parse(String(commenceTime || ""));
  const cutoff = Number.isFinite(cutoffParsed) ? cutoffParsed : now;
  const baseResults = Array.isArray(basePayload.results) ? basePayload.results : [];
  const homeBefore = teamSampleCount(baseResults, homeTeam, cutoff);
  const awayBefore = teamSampleCount(baseResults, awayTeam, cutoff);
  const requests = [];

  if (homeBefore < TEAM_DEPTH_MIN_RESULTS) {
    requests.push({
      side: "home",
      team: homeTeam,
      promise: fetchTeamHistory({ team: homeTeam, existingResults: baseResults, now })
    });
  }
  if (awayBefore < TEAM_DEPTH_MIN_RESULTS) {
    requests.push({
      side: "away",
      team: awayTeam,
      promise: fetchTeamHistory({ team: awayTeam, existingResults: baseResults, now })
    });
  }

  if (!requests.length) {
    return {
      ...basePayload,
      teamDepth: {
        attempted: false,
        reason: "league-history-sufficient",
        minimumResultsPerTeam: TEAM_DEPTH_MIN_RESULTS,
        rows: [
          safeTeamDepthRow(homeTeam, homeBefore, homeBefore),
          safeTeamDepthRow(awayTeam, awayBefore, awayBefore)
        ]
      }
    };
  }

  const resolved = await Promise.all(requests.map(async (request) => ({
    ...request,
    result: await request.promise
  })));
  const additions = resolved.flatMap((row) => Array.isArray(row.result?.results) ? row.result.results : []);
  const results = mergeTeamHistoryResults(baseResults, additions);
  const homeAfter = teamSampleCount(results, homeTeam, cutoff);
  const awayAfter = teamSampleCount(results, awayTeam, cutoff);
  const providerBySide = Object.fromEntries(resolved.map((row) => [row.side, row.result]));

  return {
    ...basePayload,
    resultCount: results.length,
    results,
    teamDepth: {
      attempted: true,
      reason: homeAfter >= TEAM_DEPTH_MIN_RESULTS && awayAfter >= TEAM_DEPTH_MIN_RESULTS
        ? "team-history-completed-depth"
        : "team-history-still-insufficient",
      minimumResultsPerTeam: TEAM_DEPTH_MIN_RESULTS,
      addedResults: Math.max(0, results.length - baseResults.length),
      rows: [
        safeTeamDepthRow(homeTeam, homeBefore, homeAfter, providerBySide.home),
        safeTeamDepthRow(awayTeam, awayBefore, awayAfter, providerBySide.away)
      ]
    }
  };
}

async function loadBaseLeagueResults({ sportKey, league, now = Date.now(), fetchImpl = fetch } = {}) {
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

  const season = seasonForSport(sportKey, now);
  const key = cacheKey(leagueKey, season);
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
  const recentUrl = new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/eventspastleague.php`);
  recentUrl.searchParams.set("id", leagueId);
  const recent = await fetchSportsDbEvents(recentUrl, { fetchImpl });

  if (!recent.ok) {
    return {
      ok: false,
      source: "thesportsdb",
      mode: recent.status ? "provider_error" : "timeout",
      leagueKey,
      status: recent.status,
      retrievedAt: new Date(now).toISOString(),
      error: recent.error,
      results: []
    };
  }

  let seasonDepth = {
    attempted: false,
    ok: false,
    rawCount: 0,
    resultCount: 0,
    addedResults: 0,
    reason: "recent-window-sufficient"
  };
  let results = recent.results.slice(0, RECENT_RESULT_LIMIT);

  if (results.length < SEASON_DEPTH_MIN_RESULTS) {
    const seasonUrl = new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/eventsseason.php`);
    seasonUrl.searchParams.set("id", leagueId);
    seasonUrl.searchParams.set("s", season);
    const depth = await fetchSportsDbEvents(seasonUrl, { fetchImpl });
    const merged = depth.ok ? mergeEvents(results, depth.results) : results;
    seasonDepth = {
      attempted: true,
      ok: depth.ok,
      rawCount: depth.rawEvents.length,
      resultCount: depth.results.length,
      addedResults: Math.max(0, merged.length - results.length),
      reason: depth.ok ? "recent-window-below-depth-target" : depth.status ? "season-provider-error" : "season-provider-timeout"
    };
    results = merged;
  }

  const payload = {
    ok: true,
    source: "thesportsdb",
    mode: "live",
    leagueKey,
    leagueId,
    season,
    retrievedAt: new Date(now).toISOString(),
    rawCount: recent.rawEvents.length,
    recentResultCount: recent.results.length,
    resultCount: results.length,
    seasonDepth,
    results,
    cached: false,
    cacheAgeSeconds: 0
  };

  pruneCache();
  cache.set(key, { storedAt: now, payload });
  return payload;
}

export async function fetchRecentLeagueResults({
  sportKey,
  league,
  homeTeam,
  awayTeam,
  commenceTime,
  now = Date.now(),
  fetchImpl = fetch,
  fetchTeamHistory = fetchSportsDbTeamHistory
} = {}) {
  const basePayload = await loadBaseLeagueResults({ sportKey, league, now, fetchImpl });
  if (!basePayload.ok || basePayload.mode !== "live") return basePayload;
  return enrichWithTeamHistory(basePayload, {
    homeTeam,
    awayTeam,
    commenceTime,
    now,
    fetchTeamHistory
  });
}

export function resetResultsProviderCacheForTests() {
  cache.clear();
}

export const RESULTS_PROVIDER_POLICY = Object.freeze({
  cacheTtlMinutes: CACHE_TTL_MS / 60000,
  maximumResultsPerLeague: RESULT_LIMIT,
  recentResultLimit: RECENT_RESULT_LIMIT,
  seasonDepthMinimumResults: SEASON_DEPTH_MIN_RESULTS,
  teamDepthMinimumResults: TEAM_DEPTH_MIN_RESULTS,
  teamHistoryFallback: "thesportsdb-v2-previous-team",
  baseLeagueCacheDoesNotIncludeMatchSpecificTeamDepth: true,
  supportedSportKeys: Object.keys(SPORTSDB_KEY_BY_SPORT),
  probabilityChanged: false,
  paperOnly: true
});
