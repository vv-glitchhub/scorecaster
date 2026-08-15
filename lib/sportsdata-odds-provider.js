import { sportsDataGet } from "./sportsdata-fetcher.js";

const CACHE_TTL_MS = 90 * 1000;
const CACHE_KEY = "__scorecasterSportsDataOddsCacheV2";
const MIN_MATCH_CONFIDENCE = 0.92;
const MAX_SPORTSBOOKS = 24;
const MONTHS = Object.freeze(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]);

function clean(value, limit = 180) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function normalizedTeam(value) {
  return clean(value, 140)
    .toLowerCase()
    .replace(/\b(the|basketball|club|bc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamTokens(value) {
  return normalizedTeam(value).split(" ").filter((token) => token.length >= 2);
}

function teamSimilarity(left, right) {
  const a = normalizedTeam(left);
  const b = normalizedTeam(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.96;
  const aTokens = new Set(teamTokens(a));
  const bTokens = new Set(teamTokens(b));
  if (!aTokens.size || !bTokens.size) return 0;
  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function matchConfidence(game = {}, match = {}) {
  const home = teamSimilarity(game.HomeTeamName || game.HomeTeam || game.homeTeam, match.homeTeam);
  const away = teamSimilarity(game.AwayTeamName || game.AwayTeam || game.awayTeam, match.awayTeam);
  if (home < 0.75 || away < 0.75) return 0;
  return Number(((home + away) / 2).toFixed(3));
}

function easternDateParts(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const monthIndex = Number(byType.month) - 1;
  if (!MONTHS[monthIndex]) return null;
  return { year: byType.year, month: MONTHS[monthIndex], day: byType.day };
}

export function sportsDataWnbaOddsDate(value) {
  const parts = easternDateParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : null;
}

export function sportsDataWnbaOddsPath(match = {}) {
  const day = sportsDataWnbaOddsDate(match.commenceTime);
  return day ? `/v3/wnba/scores/JSON/GameOddsByDate/${day}` : null;
}

export function americanToDecimal(value) {
  if (value === null || value === undefined || value === "") return null;
  const american = Number(value);
  if (!Number.isFinite(american) || american === 0 || Math.abs(american) < 100) return null;
  const decimal = american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
  return Number.isFinite(decimal) && decimal > 1 ? Number(decimal.toFixed(4)) : null;
}

function aggregateMoneyline(rows = [], field) {
  const prices = rows
    .slice(0, MAX_SPORTSBOOKS)
    .map((row) => ({
      sportsbook: clean(row?.Sportsbook || row?.SportsbookName, 80) || "unknown",
      decimal: americanToDecimal(row?.[field]),
      updatedAt: row?.Updated || row?.Created || null
    }))
    .filter((row) => row.decimal !== null);
  if (!prices.length) return null;
  const values = prices.map((row) => row.decimal);
  return {
    average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)),
    best: Number(Math.max(...values).toFixed(4)),
    bookmakerCount: new Set(prices.map((row) => row.sportsbook)).size,
    latestAt: prices.map((row) => row.updatedAt).filter(Boolean).sort().at(-1) || null,
    sportsbooks: [...new Set(prices.map((row) => row.sportsbook))].slice(0, MAX_SPORTSBOOKS)
  };
}

export function normalizeSportsDataWnbaOdds(payload, match = {}) {
  const games = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.games)
        ? payload.games
        : [];

  const candidates = games
    .map((game) => ({ game, confidence: matchConfidence(game, match) }))
    .filter((row) => row.confidence >= MIN_MATCH_CONFIDENCE)
    .sort((left, right) => right.confidence - left.confidence);

  if (candidates.length !== 1) {
    return {
      ok: false,
      mode: candidates.length > 1 ? "ambiguous_match" : "event_not_found",
      matchConfidence: candidates[0]?.confidence || 0,
      candidateCount: candidates.length,
      data: null
    };
  }

  const selected = candidates[0];
  const oddsRows = (Array.isArray(selected.game?.PregameOdds) ? selected.game.PregameOdds : [])
    .filter((row) => !row?.OddType || String(row.OddType).toLowerCase().includes("pregame"));
  const home = aggregateMoneyline(oddsRows, "HomeMoneyLine");
  const away = aggregateMoneyline(oddsRows, "AwayMoneyLine");

  if (!home || !away) {
    return {
      ok: false,
      mode: "no_usable_moneyline",
      matchConfidence: selected.confidence,
      candidateCount: 1,
      gameId: selected.game?.GameID || selected.game?.GameId || null,
      data: null
    };
  }

  return {
    ok: true,
    mode: "live",
    matchConfidence: selected.confidence,
    candidateCount: 1,
    gameId: selected.game?.GameID || selected.game?.GameId || null,
    underlyingSportsbookCount: new Set([...home.sportsbooks, ...away.sportsbooks]).size,
    data: { home, away }
  };
}

function cacheStore() {
  if (!globalThis[CACHE_KEY]) globalThis[CACHE_KEY] = new Map();
  return globalThis[CACHE_KEY];
}

async function cachedGet(path, get = sportsDataGet) {
  const store = cacheStore();
  const now = Date.now();
  const cached = store.get(path);
  if (cached && now - cached.storedAt <= CACHE_TTL_MS) return { ...cached.result, cached: true };
  const result = await get(path);
  if (result?.mode === "live") store.set(path, { storedAt: now, result });
  return { ...result, cached: false };
}

export async function fetchSportsDataOddsForMatch(match = {}, { get = sportsDataGet } = {}) {
  const sportKey = clean(match.sportKey || match.sport || match.league, 120).toLowerCase();
  if (!sportKey.includes("wnba")) {
    return {
      ok: true,
      source: "sportsdata",
      mode: "unsupported_league",
      retrievedAt: new Date().toISOString(),
      eventRequestMade: false,
      data: null
    };
  }

  const path = sportsDataWnbaOddsPath(match);
  if (!path) {
    return {
      ok: false,
      source: "sportsdata",
      mode: "invalid_event_time",
      retrievedAt: new Date().toISOString(),
      eventRequestMade: false,
      data: null
    };
  }

  const response = await cachedGet(path, get);
  const retrievedAt = new Date().toISOString();
  if (!response?.ok || response?.mode !== "live") {
    return {
      ok: false,
      source: "sportsdata",
      mode: response?.mode || "unavailable",
      status: response?.status || null,
      path,
      retrievedAt,
      eventRequestMade: true,
      subscriptionUnavailable: response?.mode === "subscription_unavailable",
      data: null
    };
  }

  const normalized = normalizeSportsDataWnbaOdds(response.data, match);
  return {
    ...normalized,
    source: "sportsdata",
    providerFamily: "sportsdataio",
    path,
    retrievedAt,
    cached: response.cached === true,
    eventRequestMade: true,
    subscriptionUnavailable: false,
    probabilityChanged: false,
    paperOnly: true
  };
}

export function resetSportsDataOddsCacheForTests() {
  cacheStore().clear();
}

export const SPORTSDATA_ODDS_POLICY = Object.freeze({
  supportedLeagues: ["basketball_wnba"],
  cacheTtlMs: CACHE_TTL_MS,
  minimumMatchConfidence: MIN_MATCH_CONFIDENCE,
  maximumSportsbooks: MAX_SPORTSBOOKS,
  providerFamilyCount: 1,
  endpointFamily: "wnba-v3-scores-pregame-odds",
  dateFormat: "YYYY-MMM-DD-eastern",
  protectedWorkerOnly: true,
  probabilityChanged: false,
  paperOnly: true
});
