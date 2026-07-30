import { SPORTS } from "../../../lib/sports";

const ALLOWED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const ALLOWED_MARKETS = new Set(["h2h", "spreads", "totals"]);
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
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

  try {
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", "eu");
    url.searchParams.set("markets", markets);
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

    if (!response.ok || !Array.isArray(data)) {
      const upstreamStatus = response.status >= 400 && response.status < 500 ? 502 : 503;
      return json(
        {
          ok: false,
          source: "upstream_error",
          reason: data?.message || "Live odds provider is temporarily unavailable",
          upstreamStatus: response.status,
          sport,
          markets,
          count: 0,
          providerHeaders,
          data: []
        },
        upstreamStatus,
        { "Cache-Control": "public, s-maxage=15", "X-Content-Type-Options": "nosniff" }
      );
    }

    return json({
      ok: true,
      source: "live",
      mode: data.length ? "live" : "live-empty",
      sport,
      markets,
      regions: "eu",
      count: data.length,
      providerHeaders,
      data
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json(
      {
        ok: false,
        source: "upstream_error",
        reason: timedOut ? "Live odds request timed out" : "Live odds request failed",
        sport,
        markets,
        count: 0,
        data: []
      },
      503,
      { "Cache-Control": "public, s-maxage=15", "X-Content-Type-Options": "nosniff" }
    );
  }
}