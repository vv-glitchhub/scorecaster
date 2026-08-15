import { fetchNewsForMatch } from "./news-fetcher";
import { fetchInjuriesForMatch } from "./injury-fetcher";
import { fetchLineupForMatch } from "./lineup-fetcher";
import { buildSportsIntelligenceReport } from "./sports-intelligence-v1.mjs";
import { attachSportsProviderDiagnostics } from "./sports-provider-diagnostics-v1.mjs";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_LIMIT = 500;
const PROVIDER_WINDOW_MS = 5 * 60 * 1000;
const PROVIDER_MISS_LIMIT = 72;
const GLOBAL_CACHE_KEY = "__scorecasterSportsIntelligenceCacheV1";
const GLOBAL_BUDGET_KEY = "__scorecasterSportsIntelligenceBudgetV1";

function cacheStore() {
  if (!globalThis[GLOBAL_CACHE_KEY]) globalThis[GLOBAL_CACHE_KEY] = new Map();
  return globalThis[GLOBAL_CACHE_KEY];
}

function providerBudget() {
  if (!globalThis[GLOBAL_BUDGET_KEY]) {
    globalThis[GLOBAL_BUDGET_KEY] = { windowStartedAt: 0, misses: 0 };
  }
  return globalThis[GLOBAL_BUDGET_KEY];
}

function clean(value, maximum = 160) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

export function normalizeSportsIntelligenceMatch(input = {}) {
  const homeTeam = clean(input.homeTeam, 120);
  const awayTeam = clean(input.awayTeam, 120);
  const sport = clean(input.sport, 120);
  const league = clean(input.league, 120);
  const commenceTime = clean(input.commenceTime, 80);
  const eventId = clean(input.eventId, 160);

  if (!homeTeam || !awayTeam || !sport) return null;
  if (homeTeam.toLowerCase() === awayTeam.toLowerCase()) return null;
  if (commenceTime && !Number.isFinite(Date.parse(commenceTime))) return null;

  return {
    homeTeam,
    awayTeam,
    sport,
    league,
    commenceTime: commenceTime || null,
    eventId: eventId || null
  };
}

function cacheKey(match) {
  return [
    match.eventId || "no-event",
    match.sport,
    match.league,
    match.homeTeam,
    match.awayTeam
  ].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function readCache(key, now) {
  const store = cacheStore();
  const value = store.get(key);
  if (!value) return null;
  if (now - value.createdAt > CACHE_TTL_MS) {
    store.delete(key);
    return null;
  }
  return value.payload;
}

function writeCache(key, payload, now) {
  const store = cacheStore();
  if (store.size >= CACHE_LIMIT) {
    const oldest = [...store.entries()]
      .sort((left, right) => left[1].createdAt - right[1].createdAt)
      .slice(0, 50);
    oldest.forEach(([entryKey]) => store.delete(entryKey));
  }
  store.set(key, { createdAt: now, payload });
}

function providersConfigured() {
  return Boolean(
    process.env.NEWS_API_KEY ||
    process.env.SPORTSDATA_API_KEY ||
    (process.env.LINEUP_API_URL && process.env.LINEUP_API_KEY)
  );
}

function consumeProviderMiss(now) {
  const budget = providerBudget();
  if (!budget.windowStartedAt || now - budget.windowStartedAt >= PROVIDER_WINDOW_MS) {
    budget.windowStartedAt = now;
    budget.misses = 0;
  }
  if (budget.misses >= PROVIDER_MISS_LIMIT) return false;
  budget.misses += 1;
  return true;
}

function reportWithDiagnostics(match, intelligence, now) {
  return attachSportsProviderDiagnostics(
    buildSportsIntelligenceReport({ match, intelligence, now }),
    intelligence
  );
}

function budgetExhausted(match, now) {
  const intelligence = {
    news: { ok: false, mode: "budget_exhausted", source: "news-provider", data: [] },
    injuries: { ok: false, mode: "budget_exhausted", source: "injury-provider", data: [] },
    lineup: { ok: false, mode: "budget_exhausted", source: "lineup-provider", data: { teams: [] } }
  };
  const report = reportWithDiagnostics(match, intelligence, now);
  return {
    ok: true,
    generatedAt: new Date(now).toISOString(),
    match,
    report,
    readiness: report.readiness,
    intelligence,
    cached: false,
    providerBudgetExhausted: true,
    paperOnly: true,
    serviceMode: "server-internal-provider-service"
  };
}

export async function loadSportsIntelligence(input, { now = Date.now() } = {}) {
  const match = normalizeSportsIntelligenceMatch(input);
  if (!match) return { ok: false, error: "Invalid match input" };

  const key = cacheKey(match);
  const cached = readCache(key, now);
  if (cached) return { ...cached, cached: true };

  if (providersConfigured() && !consumeProviderMiss(now)) {
    return budgetExhausted(match, now);
  }

  const [news, injuries, lineup] = await Promise.all([
    fetchNewsForMatch(match),
    fetchInjuriesForMatch(match),
    fetchLineupForMatch(match)
  ]);

  const intelligence = { news, injuries, lineup };
  const report = reportWithDiagnostics(match, intelligence, now);
  const payload = {
    ok: true,
    generatedAt: new Date(now).toISOString(),
    match,
    report,
    readiness: report.readiness,
    intelligence,
    cached: false,
    providerBudgetExhausted: false,
    paperOnly: true,
    serviceMode: "server-internal-provider-service"
  };

  writeCache(key, payload, now);
  return payload;
}

export function resetSportsIntelligenceCacheForTests() {
  cacheStore().clear();
  const budget = providerBudget();
  budget.windowStartedAt = 0;
  budget.misses = 0;
}

export const SPORTS_INTELLIGENCE_CACHE_TTL_MS = CACHE_TTL_MS;
export const SPORTS_INTELLIGENCE_CACHE_LIMIT = CACHE_LIMIT;
export const SPORTS_INTELLIGENCE_PROVIDER_WINDOW_MS = PROVIDER_WINDOW_MS;
export const SPORTS_INTELLIGENCE_PROVIDER_MISS_LIMIT = PROVIDER_MISS_LIMIT;
