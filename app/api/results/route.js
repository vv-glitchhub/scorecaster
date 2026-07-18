import { fetchRecentLeagueResults } from "../../../lib/results-provider.js";

export const dynamic = "force-dynamic";

const ALLOWED_QUERY_KEYS = new Set(["sport", "league"]);

function clean(value, limit = 120) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export async function GET(request) {
  const url = new URL(request.url);
  const unknown = [...url.searchParams.keys()].filter((key) => !ALLOWED_QUERY_KEYS.has(key));
  if (unknown.length) {
    return Response.json(
      { ok: false, error: "Unsupported query parameter", results: [] },
      { status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
    );
  }

  const sportKey = clean(url.searchParams.get("sport"), 120);
  const league = clean(url.searchParams.get("league"), 80);
  if (!sportKey && !league) {
    return Response.json(
      { ok: false, error: "Sport or league is required", results: [] },
      { status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
    );
  }

  const provider = await fetchRecentLeagueResults({ sportKey, league });
  return Response.json(
    {
      ok: provider.ok,
      source: provider.source,
      mode: provider.mode,
      sport: sportKey || null,
      league: provider.leagueKey || league || null,
      retrievedAt: provider.retrievedAt,
      cached: Boolean(provider.cached),
      resultCount: provider.resultCount || 0,
      reason: provider.ok ? "" : provider.error || "Results provider failed",
      results: provider.results || []
    },
    {
      status: provider.ok ? 200 : 502,
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
