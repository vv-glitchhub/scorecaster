import { namesMatch, normalizeSportsDbEvents } from "./results-normalizer.js";

const CACHE_TTL_MS = 15 * 60 * 1000;
const BUDGET_WINDOW_MS = 5 * 60 * 1000;
const MAX_ACQUISITIONS_PER_WINDOW = 8;
const CACHE_KEY = "__scorecasterSportsDbTeamHistoryV1";
const BUDGET_KEY = "__scorecasterSportsDbTeamHistoryBudgetV1";
const MIN_USEFUL_RESULTS = 3;

function clean(value, limit = 160) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cacheStore() {
  if (!globalThis[CACHE_KEY]) globalThis[CACHE_KEY] = new Map();
  return globalThis[CACHE_KEY];
}

function budgetStore() {
  if (!globalThis[BUDGET_KEY]) globalThis[BUDGET_KEY] = { windowStartedAt: 0, acquisitions: 0 };
  return globalThis[BUDGET_KEY];
}

function consumeAcquisition(now) {
  const budget = budgetStore();
  if (!budget.windowStartedAt || now - budget.windowStartedAt >= BUDGET_WINDOW_MS) {
    budget.windowStartedAt = now;
    budget.acquisitions = 0;
  }
  if (budget.acquisitions >= MAX_ACQUISITIONS_PER_WINDOW) return false;
  budget.acquisitions += 1;
  return true;
}

function teamIdFromExistingResults(results = [], team = "") {
  for (const event of Array.isArray(results) ? results : []) {
    const raw = event?.raw || {};
    if (namesMatch(event?.home_team, team)) {
      const id = raw.idHomeTeam ?? raw.idHome ?? event.idHomeTeam ?? null;
      if (id) return String(id);
    }
    if (namesMatch(event?.away_team, team)) {
      const id = raw.idAwayTeam ?? raw.idAway ?? event.idAwayTeam ?? null;
      if (id) return String(id);
    }
  }
  return null;
}

function teamSearchSlug(team) {
  return clean(team, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function fetchV2Json(path, { apiKey, fetchImpl }) {
  if (!apiKey) return { ok: false, mode: "not_configured", status: null, data: null };
  const url = `https://www.thesportsdb.com/api/v2/json/${path}`;
  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        "X-API-KEY": apiKey,
        Accept: "application/json"
      }
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!response.ok || !data) {
      return {
        ok: false,
        mode: response.status === 401 || response.status === 403 ? "subscription_unavailable" : "provider_error",
        status: response.status,
        data: null
      };
    }
    return { ok: true, mode: "live", status: response.status, data };
  } catch {
    return { ok: false, mode: "timeout", status: null, data: null };
  }
}

function pickTeamSearchResult(payload, team) {
  const rows = Array.isArray(payload?.teams) ? payload.teams : [];
  const exact = rows.find((row) => namesMatch(row?.strTeam, team) && clean(row?.strTeam, 120).toLowerCase() === clean(team, 120).toLowerCase());
  const matched = exact || rows.find((row) => namesMatch(row?.strTeam, team));
  return matched?.idTeam ? String(matched.idTeam) : null;
}

async function resolveTeamId({ team, existingResults, apiKey, fetchImpl }) {
  const existing = teamIdFromExistingResults(existingResults, team);
  if (existing) return { teamId: existing, source: "league-history" };

  const slug = teamSearchSlug(team);
  if (!slug) return { teamId: null, source: "invalid-team" };
  const search = await fetchV2Json(`search/team/${encodeURIComponent(slug)}`, { apiKey, fetchImpl });
  if (!search.ok) return { teamId: null, source: "team-search", search };
  return {
    teamId: pickTeamSearchResult(search.data, team),
    source: "team-search",
    search
  };
}

function resultKey(event = {}) {
  return clean(event.id || `${event.date}:${event.home_team}:${event.away_team}`, 240);
}

export function mergeTeamHistoryResults(base = [], additions = []) {
  const byId = new Map();
  for (const event of [...(Array.isArray(base) ? base : []), ...(Array.isArray(additions) ? additions : [])]) {
    const key = resultKey(event);
    if (!key || byId.has(key)) continue;
    byId.set(key, event);
  }
  return [...byId.values()].slice(0, 500);
}

export async function fetchSportsDbTeamHistory({
  team,
  existingResults = [],
  now = Date.now(),
  apiKey = clean(process.env.THESPORTSDB_API_KEY || "3", 120),
  fetchImpl = fetch
} = {}) {
  const safeTeam = clean(team, 120);
  if (!safeTeam) {
    return { ok: false, source: "thesportsdb-v2-team-history", mode: "invalid_team", team: safeTeam, results: [] };
  }

  const cache = cacheStore();
  const cacheId = safeTeam.toLowerCase();
  const cached = cache.get(cacheId);
  if (cached && now - cached.storedAt <= CACHE_TTL_MS) {
    return {
      ...cached.payload,
      cached: true,
      cacheAgeSeconds: Math.max(0, Math.round((now - cached.storedAt) / 1000))
    };
  }

  if (!consumeAcquisition(now)) {
    return {
      ok: true,
      source: "thesportsdb-v2-team-history",
      mode: "budget_exhausted",
      team: safeTeam,
      retrievedAt: new Date(now).toISOString(),
      results: [],
      cached: false
    };
  }

  const resolved = await resolveTeamId({ team: safeTeam, existingResults, apiKey, fetchImpl });
  if (!resolved.teamId) {
    const payload = {
      ok: false,
      source: "thesportsdb-v2-team-history",
      mode: resolved.search?.mode || "team_not_found",
      status: resolved.search?.status || null,
      team: safeTeam,
      teamId: null,
      teamIdSource: resolved.source,
      retrievedAt: new Date(now).toISOString(),
      results: [],
      cached: false
    };
    return payload;
  }

  const previous = await fetchV2Json(`schedule/previous/team/${encodeURIComponent(resolved.teamId)}`, { apiKey, fetchImpl });
  if (!previous.ok) {
    return {
      ok: false,
      source: "thesportsdb-v2-team-history",
      mode: previous.mode,
      status: previous.status,
      team: safeTeam,
      teamId: resolved.teamId,
      teamIdSource: resolved.source,
      retrievedAt: new Date(now).toISOString(),
      results: [],
      cached: false
    };
  }

  const rawEvents = Array.isArray(previous.data?.schedule) ? previous.data.schedule : [];
  const results = normalizeSportsDbEvents(rawEvents).filter((event) =>
    namesMatch(event.home_team, safeTeam) || namesMatch(event.away_team, safeTeam)
  );
  const payload = {
    ok: true,
    source: "thesportsdb-v2-team-history",
    mode: results.length >= MIN_USEFUL_RESULTS ? "live" : "insufficient_history",
    team: safeTeam,
    teamId: resolved.teamId,
    teamIdSource: resolved.source,
    retrievedAt: new Date(now).toISOString(),
    rawCount: rawEvents.length,
    resultCount: results.length,
    results,
    cached: false,
    cacheAgeSeconds: 0
  };

  if (results.length > 0) cache.set(cacheId, { storedAt: now, payload });
  return payload;
}

export function teamCompletedSampleCount(results = [], team = "", cutoff = Infinity) {
  return (Array.isArray(results) ? results : []).filter((event) => {
    if (!event?.is_finished) return false;
    if (!namesMatch(event.home_team, team) && !namesMatch(event.away_team, team)) return false;
    const timestamp = Date.parse(String(event?.raw?.strTimestamp || `${event.date || ""}T${event.time || "00:00:00"}Z`));
    return Number.isFinite(timestamp) && timestamp < cutoff;
  }).length;
}

export function resetSportsDbTeamHistoryForTests() {
  cacheStore().clear();
  const budget = budgetStore();
  budget.windowStartedAt = 0;
  budget.acquisitions = 0;
}

export const SPORTSDATA_TEAM_HISTORY_POLICY = Object.freeze({
  source: "thesportsdb-v2-team-history",
  cacheTtlMinutes: CACHE_TTL_MS / 60000,
  budgetWindowMinutes: BUDGET_WINDOW_MS / 60000,
  maxAcquisitionsPerWindow: MAX_ACQUISITIONS_PER_WINDOW,
  minimumUsefulResults: MIN_USEFUL_RESULTS,
  auth: "X-API-KEY",
  endpoint: "schedule/previous/team/{id}",
  chronologyAppliedByConsumer: true,
  probabilityChanged: false,
  paperOnly: true
});
