import { GET as getRecommendations } from "../../recommendations/route.js";
import {
  authenticateEnterpriseApi,
  enterpriseApiHeaders,
  enterpriseRecommendationView
} from "../../../../lib/enterprise-api-auth.js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function json(payload, status, auth = null) {
  return Response.json(payload, { status, headers: enterpriseApiHeaders(auth) });
}

function cleanSportKeys(value) {
  return [...new Set(String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[a-z0-9_:-]{1,120}$/.test(item)))]
    .slice(0, 12);
}

export async function GET(request) {
  const auth = await authenticateEnterpriseApi(request, "recommendations:read");
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status, auth);

  const url = new URL(request.url);
  const allowed = new Set(["limit", "sports", "decision"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return json({ ok: false, error: "Unsupported query parameter" }, 400, auth);
  }

  const limit = Math.max(1, Math.min(20, Number.parseInt(url.searchParams.get("limit") || "10", 10) || 10));
  const sports = cleanSportKeys(url.searchParams.get("sports"));
  const decision = String(url.searchParams.get("decision") || "").trim().toUpperCase();
  if (decision && !["PLAY", "CAUTION", "SKIP"].includes(decision)) {
    return json({ ok: false, error: "decision must be PLAY, CAUTION or SKIP" }, 400, auth);
  }

  try {
    const target = new URL("/api/recommendations", request.url);
    target.searchParams.set("limit", "20");
    const response = await getRecommendations(new Request(target, { method: "GET" }));
    const payload = await response.json();
    if (!response.ok || payload?.ok !== true || !Array.isArray(payload.recommendations)) {
      return json({ ok: false, error: "Recommendation analysis is unavailable" }, 503, auth);
    }

    const filtered = payload.recommendations
      .filter((item) => !sports.length || sports.includes(String(item.sportKey || "").toLowerCase()))
      .filter((item) => !decision || String(item.decision || "").toUpperCase() === decision)
      .slice(0, limit)
      .map(enterpriseRecommendationView);

    return json({
      ok: true,
      version: "scorecaster-enterprise-recommendations-v1",
      generatedAt: payload.generatedAt || new Date().toISOString(),
      tenant: { slug: auth.tenant.slug, name: auth.tenant.name },
      dataBoundary: "derived-analysis-only",
      rawOddsRedistributed: false,
      rawProviderPayloadRedistributed: false,
      bookmakerFeedRedistributed: false,
      paperOnly: true,
      realMoneyActionAvailable: false,
      count: filtered.length,
      recommendations: filtered,
      disclaimer: "Decision-support analytics only. No wager is placed and upstream raw data is not redistributed."
    }, 200, auth);
  } catch {
    return json({ ok: false, error: "Recommendation analysis is unavailable" }, 503, auth);
  }
}
