const API_BASE = "https://api.odds-api.io/v3";
const BOOKMAKER = "Veikkaus";
const BOOKMAKER_KEY = "veikkaus";
const MAX_MATCH_DELTA_MS = 6 * 60 * 60 * 1000;
const MAX_BATCH = 10;

function clean(value, limit = 180) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function canonicalTeam(value) {
  return clean(value, 160)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|bk|if|hc|bc|club)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sportSlug(scorecasterSportKey) {
  const key = String(scorecasterSportKey || "").toLowerCase();
  if (key.startsWith("soccer_")) return "football";
  if (key.startsWith("basketball_")) return "basketball";
  if (key.startsWith("icehockey_")) return "nhl";
  if (key.startsWith("americanfootball_")) return "nfl";
  if (key.startsWith("baseball_")) return "mlb";
  if (key.startsWith("tennis_")) return "tennis";
  if (key.startsWith("mma_")) return "mma";
  if (key.startsWith("boxing_")) return "boxing";
  if (key.startsWith("golf_")) return "golf";
  return null;
}

function safeModeForStatus(status) {
  if (status === 401 || status === 403) return "auth-unavailable";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "upstream-unavailable";
  return "provider-error";
}

function providerState(overrides = {}) {
  return {
    bookmaker: BOOKMAKER,
    bookmakerKey: BOOKMAKER_KEY,
    source: "odds-api.io",
    configured: false,
    mode: "not-configured",
    networkRequestMade: false,
    matchedEvents: 0,
    offersAdded: 0,
    paperOnly: true,
    realMoneyBetting: false,
    ...overrides
  };
}

export function veikkausOddsConfiguration(env = process.env) {
  const apiKey = clean(env.VEIKKAUS_ODDS_API_IO_KEY, 300);
  return {
    configured: Boolean(apiKey),
    apiKey,
    source: "odds-api.io",
    bookmaker: BOOKMAKER
  };
}

function eventMatches(primary = {}, secondary = {}) {
  const homeMatches = canonicalTeam(primary.home_team) === canonicalTeam(secondary.home);
  const awayMatches = canonicalTeam(primary.away_team) === canonicalTeam(secondary.away);
  if (!homeMatches || !awayMatches) return false;

  const primaryTime = Date.parse(String(primary.commence_time || ""));
  const secondaryTime = Date.parse(String(secondary.date || ""));
  if (!Number.isFinite(primaryTime) || !Number.isFinite(secondaryTime)) return false;

  return Math.abs(primaryTime - secondaryTime) <= MAX_MATCH_DELTA_MS;
}

function oddsMarket(markets = [], names = []) {
  const accepted = new Set(names.map((name) => name.toLowerCase()));
  return markets.find((market) => accepted.has(String(market?.name || "").toLowerCase())) || null;
}

function positiveOdds(value) {
  const number = finite(value);
  return number && number > 1.001 && number < 100 ? number : null;
}

function marketLastUpdate(market) {
  const value = clean(market?.updatedAt, 80);
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function toH2hMarket(payload = {}) {
  const market = oddsMarket(payload.bookmakers?.[BOOKMAKER], ["ML", "Moneyline"]);
  const row = market?.odds?.[0];
  if (!row) return null;

  const outcomes = [];
  const home = positiveOdds(row.home);
  const away = positiveOdds(row.away);
  const draw = positiveOdds(row.draw);
  if (home) outcomes.push({ name: clean(payload.home, 160), price: home });
  if (away) outcomes.push({ name: clean(payload.away, 160), price: away });
  if (draw) outcomes.push({ name: "Draw", price: draw });

  if (outcomes.length < 2) return null;
  return { key: "h2h", last_update: marketLastUpdate(market), outcomes };
}

function toTotalsMarket(payload = {}) {
  const market = oddsMarket(payload.bookmakers?.[BOOKMAKER], ["Totals"]);
  const rows = Array.isArray(market?.odds) ? market.odds : [];
  const outcomes = [];
  for (const row of rows) {
    const point = finite(row.hdp ?? row.max);
    const over = positiveOdds(row.over);
    const under = positiveOdds(row.under);
    if (!Number.isFinite(point)) continue;
    if (over) outcomes.push({ name: "Over", point, price: over });
    if (under) outcomes.push({ name: "Under", point, price: under });
  }
  if (outcomes.length < 2) return null;
  return { key: "totals", last_update: marketLastUpdate(market), outcomes };
}

function toSpreadMarket(payload = {}) {
  const market = oddsMarket(payload.bookmakers?.[BOOKMAKER], ["Spread"]);
  const rows = Array.isArray(market?.odds) ? market.odds : [];
  const outcomes = [];
  for (const row of rows) {
    const point = finite(row.hdp);
    const home = positiveOdds(row.home);
    const away = positiveOdds(row.away);
    if (!Number.isFinite(point)) continue;
    if (home) outcomes.push({ name: clean(payload.home, 160), point, price: home });
    if (away) outcomes.push({ name: clean(payload.away, 160), point: -point, price: away });
  }
  if (outcomes.length < 2) return null;
  return { key: "spreads", last_update: marketLastUpdate(market), outcomes };
}

export function normalizeVeikkausBookmaker(payload = {}, requestedMarkets = ["h2h"]) {
  const allowed = new Set(requestedMarkets);
  const markets = [
    allowed.has("h2h") ? toH2hMarket(payload) : null,
    allowed.has("totals") ? toTotalsMarket(payload) : null,
    allowed.has("spreads") ? toSpreadMarket(payload) : null
  ].filter(Boolean);

  if (!markets.length) return null;
  const latest = markets
    .map((market) => Date.parse(String(market.last_update || "")))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  return {
    key: BOOKMAKER_KEY,
    title: BOOKMAKER,
    last_update: latest ? new Date(latest).toISOString() : null,
    source_provider: "odds-api.io",
    source_mode: "aggregated-public-bookmaker-odds",
    markets
  };
}

function mergeBookmaker(game, bookmaker) {
  if (!bookmaker) return game;
  const current = Array.isArray(game.bookmakers) ? game.bookmakers : [];
  return {
    ...game,
    bookmakers: [...current.filter((item) => String(item?.key || "").toLowerCase() !== BOOKMAKER_KEY), bookmaker]
  };
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

function timeWindow(now) {
  const bucketMs = 5 * 60 * 1000;
  const bucket = Math.floor(now / bucketMs) * bucketMs;
  return {
    from: new Date(bucket - 60 * 60 * 1000).toISOString(),
    to: new Date(bucket + 8 * 24 * 60 * 60 * 1000).toISOString()
  };
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export async function enrichGamesWithVeikkaus({
  games = [],
  sportKey,
  markets = ["h2h"],
  fetchImpl = fetch,
  env = process.env,
  now = Date.now()
} = {}) {
  const baseGames = Array.isArray(games) ? games : [];
  const configuration = veikkausOddsConfiguration(env);
  const sport = sportSlug(sportKey);

  if (!configuration.configured) {
    return { games: baseGames, state: providerState() };
  }
  if (!sport || !baseGames.length) {
    return {
      games: baseGames,
      state: providerState({ configured: true, mode: sport ? "no-events" : "unsupported-sport" })
    };
  }

  try {
    const window = timeWindow(now);
    const eventsUrl = new URL(`${API_BASE}/events`);
    eventsUrl.searchParams.set("apiKey", configuration.apiKey);
    eventsUrl.searchParams.set("sport", sport);
    eventsUrl.searchParams.set("bookmaker", BOOKMAKER);
    eventsUrl.searchParams.set("status", "pending");
    eventsUrl.searchParams.set("from", window.from);
    eventsUrl.searchParams.set("to", window.to);

    const eventResult = await fetchJson(eventsUrl.toString(), fetchImpl);
    if (!eventResult.response.ok || !Array.isArray(eventResult.data)) {
      return {
        games: baseGames,
        state: providerState({
          configured: true,
          mode: safeModeForStatus(eventResult.response.status),
          networkRequestMade: true
        })
      };
    }

    const matches = [];
    for (const game of baseGames) {
      const event = eventResult.data.find((candidate) => eventMatches(game, candidate));
      if (event?.id !== undefined && event?.id !== null) matches.push({ game, event });
    }

    if (!matches.length) {
      return {
        games: baseGames,
        state: providerState({ configured: true, mode: "live-no-match", networkRequestMade: true })
      };
    }

    const payloads = new Map();
    for (const batch of chunks(matches, MAX_BATCH)) {
      const oddsUrl = new URL(`${API_BASE}/odds/multi`);
      oddsUrl.searchParams.set("apiKey", configuration.apiKey);
      oddsUrl.searchParams.set("eventIds", batch.map(({ event }) => event.id).join(","));
      oddsUrl.searchParams.set("bookmakers", BOOKMAKER);
      const oddsResult = await fetchJson(oddsUrl.toString(), fetchImpl);
      if (!oddsResult.response.ok || !Array.isArray(oddsResult.data)) continue;
      for (const payload of oddsResult.data) payloads.set(String(payload.id), payload);
    }

    let offersAdded = 0;
    let matchedEvents = 0;
    const enrichedGames = baseGames.map((game) => {
      const matched = matches.find((item) => item.game === game);
      if (!matched) return game;
      const payload = payloads.get(String(matched.event.id));
      if (!payload) return game;
      const bookmaker = normalizeVeikkausBookmaker(payload, markets);
      if (!bookmaker) return game;
      matchedEvents += 1;
      offersAdded += bookmaker.markets.reduce((sum, market) => sum + market.outcomes.length, 0);
      return mergeBookmaker(game, bookmaker);
    });

    return {
      games: enrichedGames,
      state: providerState({
        configured: true,
        mode: matchedEvents ? "live" : "live-no-odds",
        networkRequestMade: true,
        matchedEvents,
        offersAdded
      })
    };
  } catch {
    return {
      games: baseGames,
      state: providerState({ configured: true, mode: "request-failed", networkRequestMade: true })
    };
  }
}

export const VEIKKAUS_BOOKMAKER_KEY = BOOKMAKER_KEY;
export const VEIKKAUS_BOOKMAKER_TITLE = BOOKMAKER;
