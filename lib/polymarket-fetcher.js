const GAMMA_ORIGIN = "https://gamma-api.polymarket.com";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_LIMIT = 300;
const MAX_SEARCH_QUERIES = 3;
const MAX_RESULTS = 5;
const GLOBAL_CACHE_KEY = "__scorecasterPolymarketCacheV1";

function cacheStore() {
  if (!globalThis[GLOBAL_CACHE_KEY]) globalThis[GLOBAL_CACHE_KEY] = new Map();
  return globalThis[GLOBAL_CACHE_KEY];
}

function clean(value, maximum = 180) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalized(value) {
  return clean(value, 300)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|hc|bc|club|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalized(value).split(" ").filter((token) => token.length >= 3);
}

function teamMatches(candidate, expected) {
  const left = normalized(candidate);
  const right = normalized(expected);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftTokens = new Set(tokens(left));
  const rightTokens = tokens(right);
  const overlap = rightTokens.filter((token) => leftTokens.has(token));
  return overlap.length >= Math.min(2, rightTokens.length);
}

function textContainsTeam(text, team) {
  const haystack = normalized(text);
  const expected = normalized(team);
  if (!haystack || !expected) return false;
  if (haystack.includes(expected)) return true;
  const expectedTokens = tokens(expected);
  return expectedTokens.length > 0 && expectedTokens.every((token) => haystack.includes(token));
}

function parseTime(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function marketTime(market = {}, event = {}) {
  return market.gameStartTime || market.eventStartTime || market.startDateIso || event.startDate || event.endDate || market.endDate || null;
}

function timeScore(candidateTime, commenceTime) {
  const candidate = parseTime(candidateTime);
  const expected = parseTime(commenceTime);
  if (candidate === null || expected === null) return { score: 0, differenceHours: null };
  const differenceHours = Math.abs(candidate - expected) / (60 * 60 * 1000);
  if (differenceHours <= 3) return { score: 0.18, differenceHours };
  if (differenceHours <= 12) return { score: 0.12, differenceHours };
  if (differenceHours <= 30) return { score: 0.06, differenceHours };
  return { score: -0.2, differenceHours };
}

function directOutcomeProbability(outcomes, prices, team) {
  const index = outcomes.findIndex((outcome) => teamMatches(outcome, team));
  if (index < 0) return null;
  const probability = finite(prices[index], NaN);
  return Number.isFinite(probability) ? clamp(probability, 0, 1) : null;
}

function yesProbability(outcomes, prices) {
  const index = outcomes.findIndex((outcome) => normalized(outcome) === "yes");
  if (index < 0) return null;
  const probability = finite(prices[index], NaN);
  return Number.isFinite(probability) ? clamp(probability, 0, 1) : null;
}

function deriveProbabilities(market, event, homeTeam, awayTeam) {
  const outcomes = safeArray(market.outcomes);
  const prices = safeArray(market.outcomePrices).map((value) => finite(value, NaN));
  if (!outcomes.length || outcomes.length !== prices.length) {
    return { homeProbability: null, awayProbability: null, mapping: "unavailable" };
  }

  const directHome = directOutcomeProbability(outcomes, prices, homeTeam);
  const directAway = directOutcomeProbability(outcomes, prices, awayTeam);
  if (directHome !== null || directAway !== null) {
    return {
      homeProbability: directHome,
      awayProbability: directAway,
      mapping: "team-outcomes"
    };
  }

  const yes = yesProbability(outcomes, prices);
  if (yes === null) return { homeProbability: null, awayProbability: null, mapping: "unsupported" };

  const question = `${market.question || ""} ${market.groupItemTitle || ""} ${event.title || ""}`;
  const asksHome = textContainsTeam(question, homeTeam) && !textContainsTeam(market.question || market.groupItemTitle || "", awayTeam);
  const asksAway = textContainsTeam(question, awayTeam) && !textContainsTeam(market.question || market.groupItemTitle || "", homeTeam);

  if (asksHome) return { homeProbability: yes, awayProbability: 1 - yes, mapping: "home-yes-no" };
  if (asksAway) return { homeProbability: 1 - yes, awayProbability: yes, mapping: "away-yes-no" };
  return { homeProbability: null, awayProbability: null, mapping: "ambiguous-yes-no" };
}

function normalizeMarket(market = {}, event = {}, match = {}) {
  const combined = `${event.title || ""} ${event.subtitle || ""} ${market.question || ""} ${market.groupItemTitle || ""} ${market.slug || ""}`;
  const eventHasHome = textContainsTeam(`${event.title || ""} ${event.subtitle || ""}`, match.homeTeam);
  const eventHasAway = textContainsTeam(`${event.title || ""} ${event.subtitle || ""}`, match.awayTeam);
  const marketHasHome = textContainsTeam(`${market.question || ""} ${market.groupItemTitle || ""}`, match.homeTeam);
  const marketHasAway = textContainsTeam(`${market.question || ""} ${market.groupItemTitle || ""}`, match.awayTeam);
  const bothTeams = (eventHasHome && eventHasAway) || (marketHasHome && marketHasAway);
  if (!bothTeams && !(textContainsTeam(combined, match.homeTeam) && textContainsTeam(combined, match.awayTeam))) return null;

  const probabilities = deriveProbabilities(market, event, match.homeTeam, match.awayTeam);
  if (probabilities.homeProbability === null && probabilities.awayProbability === null) return null;

  const timing = timeScore(marketTime(market, event), match.commenceTime);
  if (timing.differenceHours !== null && timing.differenceHours > 48) return null;

  const marketType = clean(market.sportsMarketType || market.marketType || market.formatType, 80).toLowerCase();
  const winnerLike = /moneyline|winner|h2h|match winner|game winner/.test(marketType) || probabilities.mapping !== "unsupported";
  let confidence = 0.35;
  if (eventHasHome && eventHasAway) confidence += 0.28;
  if (marketHasHome && marketHasAway) confidence += 0.18;
  if (winnerLike) confidence += 0.08;
  confidence += timing.score;
  if (probabilities.mapping === "team-outcomes") confidence += 0.12;
  if (/yes-no/.test(probabilities.mapping)) confidence += 0.06;

  const liquidity = finite(market.liquidityNum ?? market.liquidity ?? event.liquidity, 0);
  const volume = finite(market.volumeNum ?? market.volume ?? event.volume, 0);
  const updatedAt = market.updatedAt || event.updatedAt || event.published_at || null;

  return {
    id: clean(market.id || market.conditionId || market.slug, 180) || null,
    eventId: clean(event.id, 120) || null,
    title: clean(market.question || market.groupItemTitle || event.title || "Polymarket sports market", 240),
    eventTitle: clean(event.title, 240) || null,
    slug: clean(market.slug, 220) || null,
    eventSlug: clean(event.slug, 220) || null,
    url: market.slug ? `https://polymarket.com/event/${encodeURIComponent(event.slug || market.slug)}${event.slug ? `?market=${encodeURIComponent(market.slug)}` : ""}` : null,
    homeProbability: probabilities.homeProbability === null ? null : Number(probabilities.homeProbability.toFixed(4)),
    awayProbability: probabilities.awayProbability === null ? null : Number(probabilities.awayProbability.toFixed(4)),
    mapping: probabilities.mapping,
    liquidity: Number(liquidity.toFixed(2)),
    volume: Number(volume.toFixed(2)),
    bestBid: finite(market.bestBid, 0) || null,
    bestAsk: finite(market.bestAsk, 0) || null,
    spread: finite(market.spread, 0) || null,
    marketType: marketType || null,
    startTime: marketTime(market, event),
    timeDifferenceHours: timing.differenceHours === null ? null : Number(timing.differenceHours.toFixed(2)),
    matchConfidence: Number(clamp(confidence, 0, 1).toFixed(3)),
    resolutionSource: clean(market.resolutionSource || event.resolutionSource, 500) || null,
    updatedAt: updatedAt || null
  };
}

function candidateScore(market) {
  return market.matchConfidence * 100 + Math.log10(1 + market.liquidity) * 3 + Math.log10(1 + market.volume) * 2;
}

function normalizeInput(input = {}) {
  const homeTeam = clean(input.homeTeam, 120);
  const awayTeam = clean(input.awayTeam, 120);
  const sport = clean(input.sport, 120);
  const league = clean(input.league, 120);
  const commenceTime = clean(input.commenceTime, 80);
  if (!homeTeam || !awayTeam || homeTeam.toLowerCase() === awayTeam.toLowerCase()) return null;
  if (commenceTime && !Number.isFinite(Date.parse(commenceTime))) return null;
  return { homeTeam, awayTeam, sport, league, commenceTime: commenceTime || null };
}

function cacheKey(match) {
  return [match.homeTeam, match.awayTeam, match.sport, match.league, match.commenceTime || "no-time"]
    .map((value) => normalized(value))
    .join("|");
}

function readCache(key, now) {
  const entry = cacheStore().get(key);
  if (!entry) return null;
  if (now - entry.createdAt > CACHE_TTL_MS) {
    cacheStore().delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value, now) {
  const store = cacheStore();
  if (store.size >= CACHE_LIMIT) {
    [...store.entries()]
      .sort((left, right) => left[1].createdAt - right[1].createdAt)
      .slice(0, 30)
      .forEach(([oldKey]) => store.delete(oldKey));
  }
  store.set(key, { createdAt: now, value });
}

async function searchEvents(query) {
  const url = new URL("/public-search", GAMMA_ORIGIN);
  url.searchParams.set("q", query);
  url.searchParams.set("events_status", "active");
  url.searchParams.set("limit_per_type", "25");
  url.searchParams.set("page", "1");
  url.searchParams.set("keep_closed_markets", "0");
  url.searchParams.set("search_tags", "false");
  url.searchParams.set("search_profiles", "false");
  url.searchParams.set("optimized", "true");

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Scorecaster-Polymarket-Intelligence/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Polymarket search failed with HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.events) ? payload.events : [];
}

export async function fetchPolymarketForMatch(input = {}, { now = Date.now() } = {}) {
  const match = normalizeInput(input);
  if (!match) return { ok: false, source: "polymarket-gamma", mode: "invalid_input", data: [] };

  const key = cacheKey(match);
  const cached = readCache(key, now);
  if (cached) return { ...cached, cached: true };

  const queries = [...new Set([
    `${match.homeTeam} ${match.awayTeam}`,
    `${match.homeTeam} ${match.league || match.sport}`,
    `${match.awayTeam} ${match.league || match.sport}`
  ].map((value) => clean(value, 220)).filter(Boolean))].slice(0, MAX_SEARCH_QUERIES);

  try {
    const batches = await Promise.all(queries.map((query) => searchEvents(query).catch(() => [])));
    const events = [];
    const seenEvents = new Set();
    for (const event of batches.flat()) {
      const id = String(event?.id || event?.slug || "");
      if (!id || seenEvents.has(id)) continue;
      seenEvents.add(id);
      events.push(event);
    }

    const normalizedMarkets = events
      .flatMap((event) => (Array.isArray(event?.markets) ? event.markets : []).map((market) => normalizeMarket(market, event, match)))
      .filter(Boolean)
      .sort((a, b) => candidateScore(b) - candidateScore(a))
      .slice(0, MAX_RESULTS);

    const value = {
      ok: true,
      source: "polymarket-gamma",
      mode: normalizedMarkets.length ? "live" : "no_match",
      providerEndpoint: "/public-search",
      generatedAt: new Date(now).toISOString(),
      cached: false,
      match,
      queryCount: queries.length,
      eventCount: events.length,
      count: normalizedMarkets.length,
      data: normalizedMarkets,
      marketDataOnly: true,
      scoreSettlementSource: false,
      tradingEnabled: false,
      walletRequired: false,
      warning: "Polymarket prices are a secondary market signal. They may be delayed, reflect different rules, or be unavailable and never replace official results or Scorecaster market consensus."
    };
    writeCache(key, value, now);
    return value;
  } catch (error) {
    return {
      ok: false,
      source: "polymarket-gamma",
      mode: "fetch_error",
      generatedAt: new Date(now).toISOString(),
      cached: false,
      match,
      data: [],
      marketDataOnly: true,
      scoreSettlementSource: false,
      tradingEnabled: false,
      walletRequired: false,
      error: process.env.NODE_ENV === "production" ? "Polymarket market data could not be loaded" : clean(error?.message || error, 300)
    };
  }
}

export function resetPolymarketCacheForTests() {
  cacheStore().clear();
}

export const POLYMARKET_CACHE_TTL_MS = CACHE_TTL_MS;
