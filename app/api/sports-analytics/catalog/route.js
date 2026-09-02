import {
  SPORTS_ANALYTICS_FAMILIES,
  getSportsAnalyticsCoverage,
  getSportsAnalyticsDefinition,
  listSportsAnalyticsMetrics,
  listSportsAnalyticsSports
} from "../../../../lib/sports-analytics-catalog.mjs";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["sport", "family", "available"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return response({ ok: false, error: "Unsupported query parameter" }, 400);
  }

  const sport = url.searchParams.get("sport") || "";
  const family = url.searchParams.get("family") || "";
  const available = (url.searchParams.get("available") || "").split(",").map((item) => item.trim()).filter(Boolean);

  if (!sport) {
    return response({
      ok: true,
      version: "sports-analytics-catalog-v1",
      sports: listSportsAnalyticsSports(),
      families: SPORTS_ANALYTICS_FAMILIES,
      safety: {
        publishedProbabilitySource: "no-vig-market-consensus",
        analyticsCanUpgradeDecision: false,
        researchMetricsAreShadowOnly: true,
        paperOnly: true
      }
    });
  }

  const definition = getSportsAnalyticsDefinition(sport);
  if (!definition) return response({ ok: false, error: "Unsupported sport" }, 400);

  return response({
    ok: true,
    version: "sports-analytics-catalog-v1",
    sport,
    definition,
    metrics: listSportsAnalyticsMetrics(sport, family),
    coverage: available.length ? getSportsAnalyticsCoverage(sport, available) : null,
    safety: {
      publishedProbabilitySource: "no-vig-market-consensus",
      analyticsCanUpgradeDecision: false,
      researchMetricsAreShadowOnly: true,
      paperOnly: true
    }
  });
}
