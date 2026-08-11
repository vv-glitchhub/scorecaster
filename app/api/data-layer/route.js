const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function clean(value, limit = 200) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function pickId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.id, 180);
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["eventId", "sports"]);
  const unknown = [...url.searchParams.keys()].filter((key) => !allowed.has(key));
  if (unknown.length) {
    return Response.json({ ok: false, error: "Unsupported query parameter" }, { status: 400, headers: HEADERS });
  }

  const eventId = clean(url.searchParams.get("eventId"), 180);
  const sports = clean(url.searchParams.get("sports"), 500);
  const topPicksUrl = new URL("/api/top-picks", url.origin);
  if (sports) topPicksUrl.searchParams.set("sports", sports);

  try {
    const response = await fetch(topPicksUrl, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    const payload = await response.json();
    if (!response.ok || payload?.ok === false) {
      return Response.json({ ok: false, error: payload?.error || "Unified data layer is unavailable", data: [] }, { status: 503, headers: HEADERS });
    }

    const picks = Array.isArray(payload.data) ? payload.data : [];
    const selected = eventId ? picks.filter((pick) => pickId(pick) === eventId) : picks;
    const rows = selected.map((pick) => ({
      eventId: pickId(pick),
      match: pick.match,
      selection: pick.selection || pick.label,
      decision: pick.productDecision,
      odds: pick.odds,
      edge: pick.edge,
      ev: pick.ev,
      ledger: pick.unifiedSportsData || null,
      intelligenceFusion: pick.intelligenceFusionV2 || null,
      formRestShadow: pick.formRestShadow || null,
      historicalRatingShadow: pick.historicalRatingShadow || null,
      featureEngine: pick.featureEngineV1 || null,
      modelFactory: pick.modelFactoryV1 || null,
      ensembleEngine: pick.ensembleEngineV1 || null,
      decisionArchitecture: pick.decisionArchitectureV1 || null,
      providers: pick.unifiedDataProviders || {},
      dataProvenance: pick.dataProvenance || null,
      generatedAt: pick.unifiedDataGeneratedAt || payload.generatedAt
    }));

    return Response.json({
      ok: true,
      version: "unified-sports-data-api-v5",
      intelligenceFusionVersion: "intelligence-fusion-v2",
      formRestShadowVersion: "form-rest-shadow-v1",
      historicalRatingShadowVersion: "historical-rating-shadow-v1",
      featureEngineVersion: "scorecaster-feature-engine-v1",
      modelFactoryVersion: "scorecaster-model-factory-v1",
      modelPerformanceEvidenceVersion: "scorecaster-model-performance-evidence-v1",
      ensembleEngineVersion: "scorecaster-ensemble-engine-v1",
      decisionArchitectureVersion: "scorecaster-decision-architecture-v1",
      generatedAt: new Date().toISOString(),
      eventId: eventId || null,
      count: rows.length,
      history: {
        endpoint: "/api/data-layer/history",
        captureIntervalMinutes: 30,
        storesProviderObservations: true,
        storesClosingOddsPostStart: true,
        storesOperationalIncidents: true
      },
      providerPolicy: {
        primaryOdds: "The Odds API bookmaker consensus",
        secondaryOdds: "SportsGameOdds when configured and event-matched",
        historicalResults: "TheSportsDB recent completed league events with pre-event chronology filtering",
        injuries: "SportsData when supported and configured",
        lineups: "configured lineup provider",
        context: "configured sports context provider",
        weather: "Open-Meteo for outdoor events with coordinates",
        news: "NewsAPI with per-source reliability scoring"
      },
      architecture: {
        featureEngine: "audited deterministic feature snapshots with explicit missing and rejected inputs",
        modelFactory: "canonical adapter and validation boundary for deterministic shadow model outputs",
        historicalRating: "recent-results Elo-style research shadow using only completed events before the fixture",
        historicalDependencePolicy: "form/rest and historical rating share one historical-results-family top-level ensemble vote",
        performanceEvidence: "chronological pre-event holdout evidence is required before a performance weight can exist",
        ensembleEngine: "shadow-first independent-model ensemble; validated performance weights only",
        marketBenchmarkIsNotIndependentModel: true,
        featureOnlyModelsCastProbabilityVote: false,
        correlatedHistoricalModelsDoubleCounted: false,
        unauditedModelsAccepted: false,
        randomLegacyModelsRejected: true,
        automaticModelPromotion: false
      },
      safety: {
        probabilitySource: "no-vig market consensus",
        aiUsesOnlyEligibleAuditedEvidence: true,
        missingDataImputed: false,
        probabilityAdjustedByIntelligenceFusion: false,
        probabilityAdjustedByHistoricalRating: false,
        probabilityAdjustedByModelFactory: false,
        probabilityAdjustedByFeatureEnsemble: false,
        productionDecisionAdjustedByFeatureEnsemble: false,
        historicalRatingUsesPostFixtureResults: false,
        contextCanUpgrade: false,
        contextCanDowngradeVerifiedRisk: true,
        closingOddsPregameLeakage: false,
        closingOddsSource: "final stored pre-start snapshot",
        paperOnly: true
      },
      data: rows
    }, { headers: HEADERS });
  } catch (error) {
    return Response.json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Unified data layer could not be loaded" : String(error),
      data: []
    }, { status: 500, headers: HEADERS });
  }
}