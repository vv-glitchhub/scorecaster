import { SPORTS } from "../../../lib/sports";
import {
  buildMarketUniverse,
  getMarketUniverseGroups,
  getMarketUniverseRequestMarkets,
  normalizeMarketUniverseGroup
} from "../../../lib/market-universe-v1.mjs";

export const dynamic = "force-dynamic";

const ALLOWED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90",
  "X-Content-Type-Options": "nosniff"
};

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
  const markets = group ? getMarketUniverseRequestMarkets(sport, group) : [];

  if (!ALLOWED_SPORTS.has(sport) || !eventId || !group || !markets.length) {
    return json({
      ok: false,
      reason: "Unsupported sport, event or market group",
      supportedGroups: ALLOWED_SPORTS.has(sport) ? getMarketUniverseGroups(sport) : [],
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
      data: null
    }, 503, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  }

  try {
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/events/${eventId}/odds`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", "eu,uk");
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
        requestedMarkets: markets,
        providerHeaders,
        data: null
      }, response.status >= 400 && response.status < 500 ? 502 : 503, {
        "Cache-Control": "public, s-maxage=15",
        "X-Content-Type-Options": "nosniff"
      });
    }

    const universe = buildMarketUniverse(data, {
      requestedMarkets: markets,
      bankroll: 1000,
      kellyMode: "quarter",
      maxStakePercent: 1
    });

    return json({
      ok: true,
      source: "the-odds-api-event-odds",
      sport,
      eventId,
      group,
      requestedMarkets: markets,
      supportedGroups: getMarketUniverseGroups(sport),
      providerHeaders,
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
      data: null
    }, 503, { "Cache-Control": "public, s-maxage=15", "X-Content-Type-Options": "nosniff" });
  }
}
