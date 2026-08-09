import {
  evaluateSportsGameOddsCandidates,
  safeSportsGameOddsMatchDiagnostics,
  SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE,
  SPORTSGAMEODDS_TIME_WINDOW_HOURS
} from "./sportsgameodds-match-v3.mjs";
import {
  buildSportsGameOddsRequestWindow,
  sportsGameOddsRateLimitCooldownMs
} from "./sportsgameodds-request-window-v1.mjs";
import {
  classifySportsGameOddsStatus,
  isSportsGameOddsRetryableCategory,
  parseSportsGameOddsRetryAfter,
  safeSportsGameOddsUpstreamEvidence,
  sportsGameOddsBackoffMs,
  sportsGameOddsNetworkCategory
} from "./sportsgameodds-upstream-v1.mjs";
import {
  evaluateSportsGameOddsQuotaPreflight,
  sanitizeSportsGameOddsUsagePayload,
  SPORTSGAMEODDS_USAGE_CACHE_TTL_MS
} from "./sportsgameodds-usage-v1.mjs";

const BASE_URL = "https://api.sportsgameodds.com/v2/events";
const USAGE_URL = "https://api.sportsgameodds.com/v2/account/usage";
const TIME_WINDOW_MS = SPORTSGAMEODDS_TIME_WINDOW_HOURS * 60 * 60 * 1000;
const REQUEST_CACHE_TTL_MS = 60_000;
const REQUEST_CACHE_LIMIT = 200;
const REQUEST_CACHE_KEY = "__scorecasterSportsGameOddsRequestCacheV1";
const USAGE_CACHE_KEY = "__scorecasterSportsGameOddsUsageCacheV1";

const DEFAULT_LEAGUE_MAP = Object.freeze({
  basketball_nba: "NBA",
  basketball_wnba: "WNBA",
  icehockey_nhl: "NHL",
  baseball_mlb: "MLB",
  americanfootball_nfl: "NFL",
  soccer_epl: "EPL",
  soccer_spain_la_liga: "LA_LIGA",
  soccer_usa_mls: "MLS"
});

function clean(value, limit = 160) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function requestCache() {
  if (!globalThis[REQUEST_CACHE_KEY]) globalThis[REQUEST_CACHE_KEY] = new Map();
  return globalThis[REQUEST_CACHE_KEY];
}

function usageCache() {
  if (!globalThis[USAGE_CACHE_KEY]) globalThis[USAGE_CACHE_KEY] = { createdAt: 0, promise: null };
  return globalThis[USAGE_CACHE_KEY];
}

function pruneRequestCache(now = Date.now()) {
  const store = requestCache();
  for (const [key, value] of store.entries()) {
    if (!value || value.expiresAt <= now) store.delete(key);
  }
  if (store.size <= REQUEST_CACHE_LIMIT) return;
  [...store.entries()]
    .sort((left, right) => left[1].createdAt - right[1].createdAt)
    .slice(0, store.size - REQUEST_CACHE_LIMIT)
    .forEach(([key]) => store.delete(key));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function leagueMap() {
  try {
    const configured = JSON.parse(process.env.SPORTSGAMEODDS_LEAGUE_MAP_JSON || "{}");
    return { ...DEFAULT_LEAGUE_MAP, ...(configured && typeof configured === "object" ? configured : {}) };
  } catch {
    return DEFAULT_LEAGUE_MAP;
  }
}

function americanToDecimal(value) {
  const number = Number(String(value || "").replace(/[^0-9+.-]/g, ""));
  if (!Number.isFinite(number) || number === 0) return null;
  return Number((number > 0 ? 1 + number / 100 : 1 + 100 / Math.abs(number)).toFixed(4));
}

function marketOdds(event, side) {
  const markets = event?.odds && typeof event.odds === "object" ? Object.values(event.odds) : [];
  const candidates = markets.filter((market) => {
    const sideId = String(market?.sideID || market?.sideId || "").toLowerCase();
    const betType = String(market?.betTypeID || market?.betTypeId || "").toLowerCase();
    const period = String(market?.periodID || market?.periodId || "").toLowerCase();
    return sideId === side && ["ml", "moneyline"].includes(betType) && ["game", "all", "reg", ""].includes(period);
  });

  const rows = [];
  for (const market of candidates) {
    const byBookmaker = market?.byBookmaker && typeof market.byBookmaker === "object" ? market.byBookmaker : {};
    for (const [bookmaker, quote] of Object.entries(byBookmaker)) {
      if (quote?.available === false) continue;
      const decimal = americanToDecimal(quote?.odds);
      if (!decimal) continue;
      rows.push({
        bookmaker: clean(bookmaker, 80),
        odds: decimal,
        updatedAt: quote?.lastUpdatedAt || event?.updatedAt || null
      });
    }
  }
  return rows;
}

function summarizeSide(rows = []) {
  if (!rows.length) return { best: null, average: null, bookmakerCount: 0, latestAt: null, quotes: [] };
  const odds = rows.map((row) => row.odds).filter(Number.isFinite);
  const latest = rows.map((row) => Date.parse(row.updatedAt || "")).filter(Number.isFinite).sort((a, b) => b - a)[0];
  return {
    best: Math.max(...odds),
    average: Number((odds.reduce((sum, value) => sum + value, 0) / odds.length).toFixed(4)),
    bookmakerCount: new Set(rows.map((row) => row.bookmaker)).size,
    latestAt: latest ? new Date(latest).toISOString() : null,
    quotes: rows.slice(0, 30)
  };
}

async function requestUsage(apiKey) {
  const now = Date.now();
  const cache = usageCache();
  if (cache.promise && now - cache.createdAt < SPORTSGAMEODDS_USAGE_CACHE_TTL_MS) return cache.promise;

  cache.createdAt = now;
  cache.promise = (async () => {
    try {
      const response = await fetch(USAGE_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
        headers: { Accept: "application/json", "x-api-key": apiKey }
      });
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      return sanitizeSportsGameOddsUsagePayload(payload);
    } catch {
      return null;
    }
  })();
  return cache.promise;
}

async function fetchEventsOnce(url, apiKey) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
      headers: { Accept: "application/json", "x-api-key": apiKey }
    });
    const retryAfterSeconds = parseSportsGameOddsRetryAfter(response.headers.get("retry-after"));
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        evidence: safeSportsGameOddsUpstreamEvidence({
          status: response.status,
          errorCategory: classifySportsGameOddsStatus(response.status),
          retryAfterSeconds
        })
      };
    }

    if (!payload || typeof payload !== "object" || payload.success !== true || !Array.isArray(payload.data)) {
      return {
        ok: false,
        evidence: safeSportsGameOddsUpstreamEvidence({
          status: response.status,
          errorCategory: "invalid_response",
          retryAfterSeconds
        })
      };
    }

    return { ok: true, payload };
  } catch (error) {
    return {
      ok: false,
      evidence: safeSportsGameOddsUpstreamEvidence({
        errorCategory: sportsGameOddsNetworkCategory(error)
      })
    };
  }
}

async function requestEvents(url, apiKey) {
  const key = url.toString();
  const now = Date.now();
  pruneRequestCache(now);
  const store = requestCache();
  const existing = store.get(key);
  if (existing && existing.expiresAt > now) return existing.promise;

  const entry = { createdAt: now, expiresAt: now + REQUEST_CACHE_TTL_MS, promise: null };
  const promise = (async () => {
    let lastFailure = null;
    let attempts = 0;
    let retried = false;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      attempts = attempt;
      const result = await fetchEventsOnce(url, apiKey);
      if (result.ok) {
        entry.expiresAt = Date.now() + REQUEST_CACHE_TTL_MS;
        return { ...result, attempts, retried };
      }
      lastFailure = result.evidence;
      if (attempt >= 2 || !isSportsGameOddsRetryableCategory(lastFailure.errorCategory)) break;
      retried = true;
      const delay = sportsGameOddsBackoffMs(attempt);
      if (delay > 0) await sleep(delay);
    }

    let usage = null;
    if (lastFailure?.errorCategory === "rate_limited") {
      entry.expiresAt = Date.now() + sportsGameOddsRateLimitCooldownMs(lastFailure?.retryAfterSeconds);
      usage = await requestUsage(apiKey);
    } else {
      entry.expiresAt = Date.now() + REQUEST_CACHE_TTL_MS;
    }

    return {
      ok: false,
      evidence: safeSportsGameOddsUpstreamEvidence({
        status: lastFailure?.httpStatus,
        errorCategory: lastFailure?.errorCategory,
        retryAfterSeconds: lastFailure?.retryAfterSeconds,
        attempts,
        retried,
        usage
      })
    };
  })();

  entry.promise = promise;
  store.set(key, entry);
  return promise;
}

function failureMode(category) {
  if (category === "provider_timeout") return "timeout";
  if (category === "network_error") return "fetch_error";
  return "api_error";
}

export async function fetchSportsGameOddsForMatch(match = {}, { preflightUsage = false } = {}) {
  const apiKey = String(process.env.SPORTSGAMEODDS_API_KEY || "").trim();
  const retrievedAt = new Date().toISOString();
  if (!apiKey) {
    return { ok: true, source: "sportsgameodds", mode: "not_configured", retrievedAt, data: null };
  }

  const leagueID = leagueMap()[match.sportKey || match.sport || match.league] || null;
  if (!leagueID) {
    return { ok: true, source: "sportsgameodds", mode: "unsupported_league", retrievedAt, data: null };
  }

  if (preflightUsage) {
    const quota = evaluateSportsGameOddsQuotaPreflight(await requestUsage(apiKey));
    if (quota.blocked) {
      return {
        ok: false,
        source: "sportsgameodds",
        mode: "quota_exhausted",
        status: null,
        errorCategory: "rate_limited",
        retryAfterSeconds: null,
        attempts: 0,
        retried: false,
        usage: quota.usage,
        quotaPreflightBlocked: true,
        retrievedAt,
        data: null
      };
    }
  }

  const commence = Date.parse(match.commenceTime || match.commence_time || "");
  const center = Number.isFinite(commence) ? commence : Date.now();
  const requestWindow = buildSportsGameOddsRequestWindow(center, TIME_WINDOW_MS);
  const url = new URL(BASE_URL);
  url.searchParams.set("leagueID", leagueID);
  url.searchParams.set("oddsAvailable", "true");
  url.searchParams.set("includeOpenCloseOdds", "true");
  url.searchParams.set("startsAfter", requestWindow.startsAfter);
  url.searchParams.set("startsBefore", requestWindow.startsBefore);
  url.searchParams.set("limit", "50");

  const upstream = await requestEvents(url, apiKey);
  if (!upstream.ok) {
    return {
      ok: false,
      source: "sportsgameodds",
      mode: failureMode(upstream.evidence.errorCategory),
      status: upstream.evidence.httpStatus,
      errorCategory: upstream.evidence.errorCategory,
      retryAfterSeconds: upstream.evidence.retryAfterSeconds,
      attempts: upstream.evidence.attempts,
      retried: upstream.evidence.retried,
      usage: upstream.evidence.usage,
      quotaPreflightBlocked: false,
      retrievedAt,
      data: null
    };
  }

  const events = upstream.payload.data;
  const evaluation = evaluateSportsGameOddsCandidates(events, match);
  const matchDiagnostics = safeSportsGameOddsMatchDiagnostics(evaluation.diagnostics);
  const matchResult = evaluation.matchResult;

  if (!matchResult) {
    return {
      ok: true,
      source: "sportsgameodds",
      mode: "no_match",
      leagueID,
      retrievedAt,
      candidateCount: events.length,
      matchDiagnostics,
      attempts: upstream.attempts,
      retried: upstream.retried,
      quotaPreflightBlocked: false,
      data: null
    };
  }

  if (matchResult.confidence < SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE) {
    return {
      ok: true,
      source: "sportsgameodds",
      mode: "low_match_confidence",
      leagueID,
      retrievedAt,
      candidateCount: events.length,
      matchConfidence: Number(matchResult.confidence.toFixed(3)),
      matchDiagnostics,
      attempts: upstream.attempts,
      retried: upstream.retried,
      quotaPreflightBlocked: false,
      data: null
    };
  }

  const providerHome = summarizeSide(marketOdds(matchResult.event, "home"));
  const providerAway = summarizeSide(marketOdds(matchResult.event, "away"));
  const home = matchResult.swapped ? providerAway : providerHome;
  const away = matchResult.swapped ? providerHome : providerAway;
  return {
    ok: true,
    source: "sportsgameodds",
    mode: "live",
    leagueID,
    retrievedAt,
    matchConfidence: Number(matchResult.confidence.toFixed(3)),
    matchDiagnostics,
    orientation: matchResult.swapped ? "provider-sides-swapped" : "direct",
    attempts: upstream.attempts,
    retried: upstream.retried,
    quotaPreflightBlocked: false,
    data: {
      eventId: clean(matchResult.event.eventID || matchResult.event.id, 180),
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      providerHomeTeam: matchResult.providerHome,
      providerAwayTeam: matchResult.providerAway,
      commenceTime: matchResult.event.startsAt || matchResult.event.startTime || match.commenceTime || null,
      timeDifferenceHours: matchResult.timeDifferenceHours === null ? null : Number(matchResult.timeDifferenceHours.toFixed(2)),
      matchConfidence: Number(matchResult.confidence.toFixed(3)),
      orientation: matchResult.swapped ? "provider-sides-swapped" : "direct",
      home,
      away,
      openCloseAvailable: Boolean(Object.values(matchResult.event?.odds || {}).some((market) => market?.openBookOdds || market?.closeBookOdds || market?.openOdds || market?.closeOdds))
    }
  };
}

export function resetSportsGameOddsRequestCacheForTests() {
  requestCache().clear();
  globalThis[USAGE_CACHE_KEY] = { createdAt: 0, promise: null };
}

export const SPORTSGAMEODDS_REQUEST_CACHE_TTL_MS = REQUEST_CACHE_TTL_MS;
export { SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE };
