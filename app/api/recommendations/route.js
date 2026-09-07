import { buildRecommendationFeed } from "../../../lib/recommendation-engine.mjs";

const CACHE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

const EXTRA_DEFAULT_SPORTS = [
  "americanfootball_nfl",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one"
];

function parseLimit(searchParams) {
  const raw = Number(searchParams.get("limit") || 8);
  if (!Number.isInteger(raw) || raw < 1 || raw > 20) return null;
  return raw;
}

function topPicksUrl(origin, sports = null) {
  const target = new URL("/api/top-picks", origin);
  target.searchParams.set("view", "summary");
  if (sports) target.searchParams.set("sports", sports);
  return target;
}

async function loadTopPicks(target) {
  const response = await fetch(target, {
    cache: "no-store",
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    return { ok: false, status: response.status, payload, data: [] };
  }
  return { ok: true, status: response.status, payload, data: Array.isArray(payload.data) ? payload.data : [] };
}

function uniquePicks(groups = []) {
  const picks = new Map();
  for (const group of groups) {
    for (const pick of group || []) {
      const eventId = pick?.eventId || pick?.gameId || pick?.id || "";
      const key = [eventId, pick?.marketKey || "h2h", pick?.selection || pick?.label || "", pick?.point ?? ""].join("|");
      if (!eventId || picks.has(key)) continue;
      picks.set(key, pick);
    }
  }
  return [...picks.values()];
}

export async function GET(request) {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams);
  if (!limit) {
    return Response.json(
      { ok: false, error: "limit must be an integer between 1 and 20" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const requestedSports = url.searchParams.get("sports");
  const targets = requestedSports
    ? [topPicksUrl(url.origin, requestedSports)]
    : [
        topPicksUrl(url.origin),
        topPicksUrl(url.origin, EXTRA_DEFAULT_SPORTS.slice().sort().join(","))
      ];

  try {
    const results = await Promise.all(targets.map(loadTopPicks));
    const successful = results.filter((result) => result.ok);
    if (!successful.length) {
      const first = results[0];
      return Response.json(
        { ok: false, error: first?.payload?.error || "Top picks unavailable" },
        { status: first?.status >= 400 ? first.status : 502, headers: CACHE_HEADERS }
      );
    }

    const picks = uniquePicks(successful.map((result) => result.data));
    const feed = buildRecommendationFeed(picks, { limit });
    const leagues = [...new Set(successful.flatMap((result) => Array.isArray(result.payload?.leagues) ? result.payload.leagues : []))];
    const markets = [...new Set(successful.flatMap((result) => Array.isArray(result.payload?.markets) ? result.payload.markets : []))];
    const sportFamilies = [...new Set(leagues.map((league) => String(league || "").split("_")[0]).filter(Boolean))];
    const upstreamTimes = successful.map((result) => Date.parse(result.payload?.generatedAt || 0)).filter(Number.isFinite);

    return Response.json(
      {
        ok: true,
        ...feed,
        source: "cross-sport-top-picks",
        fixtureSource: "live-odds-provider-only",
        upstreamGeneratedAt: upstreamTimes.length ? new Date(Math.max(...upstreamTimes)).toISOString() : null,
        analysisWindowHours: successful[0]?.payload?.analysisWindowHours,
        featuredWindowHours: successful[0]?.payload?.featuredWindowHours,
        leagues,
        markets,
        sportFamilies,
        crossSportCoverage: requestedSports ? "requested" : "season-default-plus-active-extras",
        partialUpstream: successful.length !== results.length,
        disclaimer: "Paper-only decision support. PLAY means the current data passed Scorecaster's evidence and market gates; it is not a guarantee and no real-money bet is placed."
      },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Recommendation feed unavailable",
        details: process.env.NODE_ENV === "production" ? undefined : error?.message
      },
      { status: 502, headers: CACHE_HEADERS }
    );
  }
}
