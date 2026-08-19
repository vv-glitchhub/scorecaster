import { loadAdvancedModelHoldoutReport } from "../../../lib/advanced-model-holdout-service.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["days"]);
  const unknown = [...url.searchParams.keys()].filter((key) => !allowed.has(key));
  if (unknown.length) {
    return Response.json({ ok: false, error: "Unsupported query parameter" }, { status: 400, headers: HEADERS });
  }

  const days = Number(url.searchParams.get("days") || 90);
  try {
    const result = await loadAdvancedModelHoldoutReport({ days, now: Date.now() });
    return Response.json({
      ok: result.ok,
      version: "advanced-model-holdout-api-v1",
      status: result.status,
      days: result.days,
      since: result.since || null,
      cached: result.cached === true,
      collection: {
        snapshotRowsScanned: result.snapshotRowsScanned || 0,
        shadowSnapshotRows: result.shadowSnapshotRows || 0,
        leaguesRequested: result.leaguesRequested || 0,
        resultsReceived: result.resultsReceived || 0,
        providerFailures: Array.isArray(result.providerFailures) ? result.providerFailures.slice(0, 20) : [],
        advancedModelReadiness: result.advancedModelReadiness || null
      },
      report: result.report,
      safety: {
        pregameSnapshotRequired: true,
        inputSnapshotHashRequired: true,
        resultDataUsedOnlyForEvaluation: true,
        performanceWeightGeneratedAutomatically: false,
        automaticPromotionAllowed: false,
        productionProbabilityChanged: false,
        productionDecisionChanged: false,
        paperOnly: true
      },
      error: result.ok ? undefined : result.reason || "Holdout report unavailable"
    }, { status: result.ok ? 200 : 503, headers: HEADERS });
  } catch (error) {
    return Response.json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Holdout report unavailable" : String(error)
    }, { status: 500, headers: HEADERS });
  }
}
