import { SPORTS } from "../../../lib/sports";
import {
  buildMarketUniverse,
  normalizeMarketUniverseGroup
} from "../../../lib/market-universe-v1.mjs";
import {
  getSafeMarketUniverseGroups,
  getSafeMarketUniverseRequestMarkets
} from "../../../lib/market-universe-sport-catalog.mjs";
import { buildFootballMarketCoverage } from "../../../lib/football-market-taxonomy-v2.mjs";

export const dynamic = "force-dynamic";

const ALLOWED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90",
  "X-Content-Type-Options": "nosniff"
};
const MARKET_TITLES = Object.freeze({
  h2h_3_way_h1: "1st half 1X2",
  totals_h1: "1st half goals total"
});

function json(data, status = 200, headers = CACHE_HEADERS) {
  return Response.json(data, { status, headers });
}

function validEventId(value) {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9_-]{6,80}$/.test(id) ? id : null;
}

function canonicalRequestUrl(request, sport, eventId, group) {
  const canonical = new URL(request.url);
  canonical.search = new URLSearchParams({ sport, eventId, group }).toString();
  return canonical;
}

function regionsForGroup(group) {
  // The Odds API documents soccer player props as US-bookmaker coverage. Other
  // football market families use European + UK books for a stronger local view.
  return group === "players" ? "us" : "eu,uk";
}

function offeredMarketKeys(event = {}) {
  const keys = new Set();
  for (const bookmaker of Array.isArray(event.bookmakers) ? event.bookmakers : []) {
    for (const market of Array.isArray(bookmaker?.markets) ? bookmaker.markets : []) {
      if (market?.key) keys.add(String(market.key));
    }
  }
  return [...keys].sort();
}

function applyDisplayTitles(universe) {
  return {
    ...universe,
    markets: (universe?.markets || []).map((market) => ({
      ...market,
      title: MARKET_TITLES[market.key] || market.title
    }))
  };
}

function footballCoverage(sport, group, offered = null) {
  return String(sport || "").startsWith("soccer_")
    ? buildFootballMarketCoverage(group, offered)
    : null;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const unknownKeys = [...requestUrl.searchParams.keys()].filter(
    (key) => key !== "sport" && key !== "eventId" && key !== "group"
  );
  if (unknownKeys.length) {
    return json({ ok: false, reason: "Unsupported query parameter", data: null }, 400);
  }

  const sport = String(requestUrl.searchParams.get("sport") || "").trim();
  const eventId = validEventId(requestUrl.searchParams.get("eventId"));
  const group = normalizeMarketUniverseGroup(requestUrl.searchParams.get("group"));
  const markets = group ? getSafeMarketUniverseRequestMarkets(sport, group) : [];
  const supportedGroups = ALLOWED_SPORTS.has(sport) ? getSafeMarketUniverseGroups(sport) : [];

  if (!ALLOWED_SPORTS.has(sport) || !eventId || !group || !markets.length) {
    return json({
      ok: false,
      reason: "Unsupported sport, event or market group",
      supportedGroups,
      marketCoverage: group ? footballCoverage(sport, group) : null,
      data: null
    }, 400);
  }

  const canonical = canonicalRequestUrl(request, sport, eventId, group);
  if (canonical.search !== requestUrl.search) return Response.redirect(canonical, 307);

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return json({
      ok: false,
      source: "unavailable",
      reason: "Live odds are not configured",
      sport,
      eventId,
      group,
      requestedMarkets: markets,
      supportedGroups,
      marketCoverage: footballCoverage(sport, group),
      data: null
    }, 503, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  }

  const regions = regionsForGroup(group);

  try {
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/events/${eventId}/odds`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", regions);
    url.searchParams.set("markets", markets.join(","));
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");

    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => null);
    const providerHeaders = {
      requestsRemaining: response.headers.get("x-requests-remaining"),
      requestsUsed: response.headers.get("x-requests-used"),
      requestsLast: response.headers.get("x-requests-last")
    };

    if (!response.ok || !data || Array.isArray(data)) {
      return json({
        ok: false,
        source: "upstream_error",
        reason: data?.message || "This market group is unavailable for the selected event",
        upstreamStatus: response.status,
        sport,
        eventId,
        group,
        regions,
        requestedMarkets: markets,
        supportedGroups,
        providerHeaders,
        marketCoverage: footballCoverage(sport, group),
        data: null
      }, response.status >= 400 && response.status < 500 ? 502 : 503, {
        "Cache-Control": "public, s-maxage=15",
        "X-Content-Type-Options": "nosniff"
      });
    }

    const offeredMarkets = offeredMarketKeys(data);
    const universe = applyDisplayTitles(buildMarketUniverse(data, {
      requestedMarkets: markets,
      bankroll: 1000,
      kellyMode: "quarter",
      maxStakePercent: 1
    }));

    return json({
      ok: true,
      source: "the-odds-api-event-odds",
      sport,
      eventId,
      group,
      regions,
      requestedMarkets: markets,
      offeredMarkets,
      supportedGroups,
      providerHeaders,
      marketCoverage: footballCoverage(sport, group, offeredMarkets),
      quotaBoundary: "The provider charges only unique markets returned x regions for event odds; empty market data is not counted by the provider.",
      paperOnly: true,
      realMoneyBetting: false,
      decisionBoundary: "Only mathematically valid complete no-vig market units can receive PLAY/CAUTION/SKIP; other markets are PRICE_ONLY.",
      data: universe
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json({
      ok: false,
      source: "upstream_error",
      reason: timedOut ? "Market Universe request timed out" : "Market Universe request failed",
      sport,
      eventId,
      group,
      regions,
      supportedGroups,
      marketCoverage: footballCoverage(sport, group),
      data: null
    }, 503, { "Cache-Control": "public, s-maxage=15", "X-Content-Type-Options": "nosniff" });
  }
}
