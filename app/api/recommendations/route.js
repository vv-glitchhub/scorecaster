import { buildRecommendationFeed } from "../../../lib/recommendation-engine.mjs";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=180, stale-while-revalidate=420",
  "X-Content-Type-Options": "nosniff"
};

function parseLimit(searchParams) {
  const raw = Number(searchParams.get("limit") || 8);
  if (!Number.isInteger(raw) || raw < 1 || raw > 20) return null;
  return raw;
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

  const topPicksUrl = new URL("/api/top-picks", url.origin);
  topPicksUrl.searchParams.set("view", "summary");
  if (url.searchParams.get("sports")) {
    topPicksUrl.searchParams.set("sports", url.searchParams.get("sports"));
  }

  try {
    const response = await fetch(topPicksUrl, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(30000)
    });
    const payload = await response.json();

    if (!response.ok || payload?.ok !== true) {
      return Response.json(
        { ok: false, error: payload?.error || "Top picks unavailable" },
        { status: response.status >= 400 ? response.status : 502, headers: CACHE_HEADERS }
      );
    }

    const feed = buildRecommendationFeed(payload.data || [], { limit });
    return Response.json(
      {
        ok: true,
        ...feed,
        source: payload.source,
        fixtureSource: payload.fixtureSource,
        upstreamGeneratedAt: payload.generatedAt,
        analysisWindowHours: payload.analysisWindowHours,
        featuredWindowHours: payload.featuredWindowHours,
        leagues: payload.leagues,
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
