import { GET as getRecommendations } from "../../../recommendations/route.js";
import {
  authenticateEnterpriseApi,
  enterpriseApiHeaders
} from "../../../../../lib/enterprise-api-auth.js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function json(payload, status, auth = null) {
  return Response.json(payload, { status, headers: enterpriseApiHeaders(auth) });
}

export async function GET(request) {
  const auth = await authenticateEnterpriseApi(request, "leagues:read");
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status, auth);

  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => key !== "league")) {
    return json({ ok: false, error: "Unsupported query parameter" }, 400, auth);
  }
  const requestedLeague = String(url.searchParams.get("league") || "").trim().toLowerCase().slice(0, 160);

  try {
    const target = new URL("/api/recommendations", request.url);
    target.searchParams.set("limit", "20");
    const response = await getRecommendations(new Request(target, { method: "GET" }));
    const payload = await response.json();
    if (!response.ok || payload?.ok !== true || !Array.isArray(payload.leagueReadiness)) {
      return json({ ok: false, error: "League readiness analysis is unavailable" }, 503, auth);
    }

    const leagues = payload.leagueReadiness
      .filter((item) => !requestedLeague || String(item.league || "").toLowerCase() === requestedLeague)
      .map((item) => ({
        league: item.league || null,
        status: item.status || "insufficient",
        sampleSize: Number(item.sampleSize || 0),
        averageBookmakers: Number.isFinite(Number(item.averageBookmakers)) ? Number(item.averageBookmakers) : null,
        averageConfidence: Number.isFinite(Number(item.averageConfidence)) ? Number(item.averageConfidence) : null,
        verifiedEvidenceRate: Number.isFinite(Number(item.verifiedEvidenceRate)) ? Number(item.verifiedEvidenceRate) : null,
        freshRate: Number.isFinite(Number(item.freshRate)) ? Number(item.freshRate) : null,
        playCount: Number(item.playCount || 0),
        cautionCount: Number(item.cautionCount || 0),
        limitation: item.limitation || "Current live recommendation window only; not a historical league-quality rating."
      }));

    return json({
      ok: true,
      version: "scorecaster-enterprise-league-readiness-v1",
      generatedAt: payload.generatedAt || new Date().toISOString(),
      tenant: { slug: auth.tenant.slug, name: auth.tenant.name },
      dataBoundary: "derived-analysis-only",
      rawOddsRedistributed: false,
      rawProviderPayloadRedistributed: false,
      historicalLeagueQualityClaim: false,
      paperOnly: true,
      count: leagues.length,
      leagues
    }, 200, auth);
  } catch {
    return json({ ok: false, error: "League readiness analysis is unavailable" }, 503, auth);
  }
}
