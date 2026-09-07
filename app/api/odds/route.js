import { SPORTS } from "../../../lib/sports";
import { enrichGamesWithVeikkaus } from "../../../lib/veikkaus-odds-provider.mjs";

const ALLOWED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const ALLOWED_MARKETS = new Set(["h2h", "spreads", "totals"]);
const CACHE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status = 200, headers = CACHE_HEADERS) {
  return Response.json(data, { status, headers });
}

function normalizeMarkets(value) {
  const markets = [...new Set(String(value || "h2h").split(",").map((item) => item.trim()).filter(Boolean))]
    .filter((market) => ALLOWED_MARKETS.has(market))
    .sort();

  return markets.length && markets.length <= 3 ? markets.join(",") : null;
}

function canonicalRequestUrl(request, sport, markets) {
  const canonical = new URL(request.url);
  canonical.search = new URLSearchParams({ sport, markets }).toString();
  return canonical;
}

async function fetchPrimaryOdds({ sport, markets, apiKey }) {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "eu");
  url.searchParams.set("markets", markets);
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => null);
    return {
      ok: response.ok && Array.isArray(data),
      status: response.status,
      data,
      timedOut: false,
      providerHeaders: {
        requestsRemaining: response.headers.get("x-requests-remaining"),
        requestsUsed: response.headers.get("x-requests-used"),
        requestsLast: response.headers.get("x-requests-last")
      }
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      data: null,
      timedOut: error?.name === "TimeoutError" || error?.name === "AbortError",
      providerHeaders: { requestsRemaining: null, requestsUsed: null, requestsLast: null }
    };
  }
}

async function enrichAndRespond({ primary, sport, servedMarkets, requestedMarkets, fallbackReason = null }) {
  const veikkaus = await enrichGamesWithVeikkaus({
    games: primary.data,
    sportKey: sport,
    markets: servedMarkets.split(",")
  });
  const marketFallback = servedMarkets !== requestedMarkets;

  return json({
    ok: true,
    source: "live",
    mode: marketFallback ? "live-partial-markets" : veikkaus.games.length ? "live" : "live-empty",
    sport,
    markets: servedMarkets,
    requestedMarkets,
    marketFallback,
    fallbackReason,
    regions: "eu",
    count: veikkaus.games.length,
    providerHeaders: primary.providerHeaders,
    bookmakerSources: {
      primary: "the-odds-api",
      veikkaus: veikkaus.state
    },
    paperOnly: true,
    realMoneyBetting: false,
    data: veikkaus.games
  });
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const unknownKeys = [...requestUrl.searchParams.keys()].filter(
    (key) => key !== "sport" && key !== "markets"
  );

  if (unknownKeys.length) {
    return json({ ok: false, reason: "Unsupported query parameter", data: [] }, 400);
  }

  const sport = requestUrl.searchParams.get("sport") || "icehockey_nhl";
  const markets = normalizeMarkets(requestUrl.searchParams.get("markets"));

  if (!ALLOWED_SPORTS.has(sport) || !markets) {
    return json({ ok: false, reason: "Unsupported sport or market", data: [] }, 400);
  }

  const canonical = canonicalRequestUrl(request, sport, markets);
  if (canonical.search !== requestUrl.search) {
    return Response.redirect(canonical, 307);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return json(
      { ok: false, source: "unavailable", reason: "Live odds are not configured", sport, markets, count: 0, data: [] },
      503,
      { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    );
  }

  const requestedMarkets = markets;
  const primary = await fetchPrimaryOdds({ sport, markets: requestedMarkets, apiKey });
  if (primary.ok) {
    return enrichAndRespond({ primary, sport, servedMarkets: requestedMarkets, requestedMarkets });
  }

  // Some leagues/providers expose H2H but not spreads/totals. Optional market
  // support must not make the entire league disappear from Top Picks. Retry the
  // canonical winner market only when a combined request fails.
  if (requestedMarkets.includes(",") && requestedMarkets.includes("h2h")) {
    const h2h = await fetchPrimaryOdds({ sport, markets: "h2h", apiKey });
    if (h2h.ok) {
      return enrichAndRespond({
        primary: h2h,
        sport,
        servedMarkets: "h2h",
        requestedMarkets,
        fallbackReason: `Optional markets unavailable (primary HTTP ${primary.status ?? "timeout"})`
      });
    }
  }

  const upstreamStatus = primary.status !== null && primary.status >= 400 && primary.status < 500 ? 502 : 503;
  return json(
    {
      ok: false,
      source: "upstream_error",
      reason: primary.data?.message || (primary.timedOut ? "Live odds request timed out" : "Live odds provider is temporarily unavailable"),
      upstreamStatus: primary.status,
      sport,
      markets: requestedMarkets,
      count: 0,
      providerHeaders: primary.providerHeaders,
      data: []
    },
    upstreamStatus,
    { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" }
  );
}
