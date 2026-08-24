import { enrichPickWithLiveIntelligence } from "../../../lib/agent-intelligence-loader.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow"
};

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function pickId(pick = {}) {
  return clean(pick.eventId || pick.gameId || pick.id, 180);
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["eventId", "sport", "selection"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return Response.json({ ok: false, error: "Unsupported query parameter" }, { status: 400, headers: HEADERS });
  const eventId = clean(url.searchParams.get("eventId"), 180);
  const sport = clean(url.searchParams.get("sport"), 120);
  const selection = clean(url.searchParams.get("selection"), 140);
  if (!eventId || !sport) return Response.json({ ok: false, error: "eventId and sport are required" }, { status: 400, headers: HEADERS });

  try {
    const topPicksUrl = new URL("/api/top-picks", url.origin);
    topPicksUrl.searchParams.set("sports", sport);
    topPicksUrl.searchParams.set("view", "summary");
    const response = await fetch(topPicksUrl, { cache: "no-store", signal: AbortSignal.timeout(40_000) });
    const payload = await response.json();
    if (!response.ok || payload?.ok === false) return Response.json({ ok: false, error: payload?.error || "Current analysis unavailable" }, { status: 503, headers: HEADERS });
    const candidates = (Array.isArray(payload?.data) ? payload.data : []).filter((pick) => pickId(pick) === eventId);
    const base = candidates.find((pick) => !selection || clean(pick.selection || pick.label, 140).toLowerCase() === selection.toLowerCase()) || candidates[0] || null;
    if (!base) return Response.json({ ok: false, error: "Event is not in the current verified analysis" }, { status: 404, headers: HEADERS });

    const enriched = await enrichPickWithLiveIntelligence(base);
    const evidence = enriched.footballIndependentEvidenceV1 || null;
    return Response.json({
      ok: true,
      version: "football-evidence-api-v1",
      eventId,
      match: enriched.match,
      selection: enriched.selection || enriched.label,
      decision: enriched.productDecision || "CAUTION",
      evidence,
      soccerXgPoissonShadow: enriched.soccerXgPoissonShadowV1 ? {
        version: enriched.soccerXgPoissonShadowV1.version,
        modelId: enriched.soccerXgPoissonShadowV1.modelId,
        status: enriched.soccerXgPoissonShadowV1.status,
        probability: enriched.soccerXgPoissonShadowV1.probability,
        probabilities: enriched.soccerXgPoissonShadowV1.probabilities,
        projectedGoals: enriched.soccerXgPoissonShadowV1.projectedGoals,
        predictionHorizon: enriched.soccerXgPoissonShadowV1.predictionHorizon,
        inputSnapshotHash: enriched.soccerXgPoissonShadowV1.inputSnapshotHash,
        provenance: enriched.soccerXgPoissonShadowV1.provenance,
        productionProbabilityChanged: false
      } : null,
      formRest: enriched.formRestShadow ? {
        status: enriched.formRestShadow.status,
        asOf: enriched.formRestShadow.asOf,
        samplePolicy: enriched.formRestShadow.samplePolicy,
        home: enriched.formRestShadow.home,
        away: enriched.formRestShadow.away,
        features: enriched.formRestShadow.features,
        chronologyGuard: enriched.formRestShadow.chronologyGuard,
        probabilityAppliedToProduction: false
      } : null,
      availability: {
        injuries: Array.isArray(enriched.sportsIntelligence?.injuries) ? enriched.sportsIntelligence.injuries.slice(0, 20) : [],
        lineups: Array.isArray(enriched.sportsIntelligence?.lineups) ? enriched.sportsIntelligence.lineups.slice(0, 4) : [],
        conflicts: Array.isArray(enriched.sportsIntelligence?.conflicts) ? enriched.sportsIntelligence.conflicts.slice(0, 10) : []
      },
      safety: {
        evidenceCanOnlySatisfyExistingGate: true,
        probabilityAdjusted: false,
        edgeAdjusted: false,
        evAdjusted: false,
        automaticModelPromotionAllowed: false,
        realMoneyActionAvailable: false,
        paperOnly: true
      }
    }, { headers: HEADERS });
  } catch (error) {
    return Response.json({ ok: false, error: process.env.NODE_ENV === "production" ? "Football evidence audit unavailable" : String(error), paperOnly: true }, { status: 500, headers: HEADERS });
  }
}
