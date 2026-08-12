import { buildAdvancedSignalReadinessV1 } from "../../../lib/advanced-signal-readiness-v1.mjs";
import { sportsAnalyticsProviderConfiguration } from "../../../lib/sports-analytics-provider.js";

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

    const now = Date.now();
    const analyticsProvider = sportsAnalyticsProviderConfiguration();
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
      nhlXgGoalieShadow: pick.nhlXgGoalieShadowV1 || null,
      soccerXgPoissonShadow: pick.soccerXgPoissonShadowV1 || null,
      basketballEfficiencyShadow: pick.basketballEfficiencyShadowV1 || null,
      advancedShadowInputStatus: pick.advancedShadowInputStatus || null,
      nhlAdvancedShadowInputStatus: pick.nhlAdvancedShadowInputStatus || null,
      basketballAdvancedShadowInputStatus: pick.basketballAdvancedShadowInputStatus || null,
      featureEngine: pick.featureEngineV1 || null,
      modelFactory: pick.modelFactoryV1 || null,
      ensembleEngine: pick.ensembleEngineV1 || null,
      advancedSignalReadiness: buildAdvancedSignalReadinessV1(pick, { providerConfiguration: analyticsProvider, now }),
      decisionArchitecture: pick.decisionArchitectureV1 || null,
      providers: pick.unifiedDataProviders || {},
      dataProvenance: pick.dataProvenance || null,
      generatedAt: pick.unifiedDataGeneratedAt || payload.generatedAt
    }));

    return Response.json({
      ok: true,
      version: "unified-sports-data-api-v10",
      intelligenceFusionVersion: "intelligence-fusion-v2",
      formRestShadowVersion: "form-rest-shadow-v1",
      historicalRatingShadowVersion: "historical-rating-shadow-v1",
      nhlXgGoalieShadowVersion: "nhl-xg-goalie-shadow-v1",
      soccerXgPoissonShadowVersion: "soccer-xg-poisson-shadow-v1",
      basketballEfficiencyShadowVersion: "basketball-efficiency-shadow-v1",
      advancedModelHoldoutVersion: "scorecaster-advanced-model-holdout-v1",
      featureEngineVersion: "scorecaster-feature-engine-v1",
      modelFactoryVersion: "scorecaster-model-factory-v1",
      modelLineageGuardVersion: "scorecaster-model-lineage-guard-v1",
      advancedSignalReadinessVersion: "scorecaster-advanced-signal-readiness-v1",
      modelPerformanceEvidenceVersion: "scorecaster-model-performance-evidence-v1",
      ensembleEngineVersion: "scorecaster-ensemble-engine-v1",
      decisionArchitectureVersion: "scorecaster-decision-architecture-v1",
      generatedAt: new Date(now).toISOString(),
      eventId: eventId || null,
      count: rows.length,
      externalAnalyticsConfiguration: {
        configured: analyticsProvider.configured === true,
        source: analyticsProvider.source,
        transport: analyticsProvider.transport,
        contract: analyticsProvider.contract
      },
      history: {
        endpoint: "/api/data-layer/history",
        advancedModelHoldoutEndpoint: "/api/model-holdout",
        captureIntervalMinutes: 30,
        storesProviderObservations: true,
        storesAdvancedShadowPredictions: true,
        storesClosingOddsPostStart: true,
        storesOperationalIncidents: true
      },
      providerPolicy: {
        primaryOdds: "The Odds API bookmaker consensus",
        secondaryOdds: "SportsGameOdds when configured and event-matched",
        historicalResults: "TheSportsDB recent completed league events with pre-event chronology filtering",
        advancedIndependentSignals: "licensed external advanced analytics may feed deterministic shadow models only through stored chronology-safe observations and audited lineage",
        nhlAdvancedModel: "xGF/xGA plus optional post-shot xG and both confirmed starting-goalie GSAx/60 inputs; market and mirrored providers are excluded",
        soccerAdvancedModel: "xGF/xGA per 90 plus optional post-shot xG/90; market and mirrored providers are excluded",
        basketballAdvancedModel: "pace plus offensive/defensive rating and optional bounded lineup-adjusted impact; market and mirrored providers are excluded",
        injuries: "SportsData when supported and configured",
        lineups: "configured lineup provider",
        context: "configured sports context provider",
        weather: "Open-Meteo for outdoor events with coordinates",
        news: "NewsAPI with per-source reliability scoring"
      },
      architecture: {
        featureEngine: "audited deterministic feature snapshots with explicit missing and rejected inputs",
        modelFactory: "canonical adapter and validation boundary for deterministic shadow model outputs",
        modelLineageGuard: "derives dependence groups from declared signal lineage instead of trusting a model-supplied group",
        advancedSignalReadiness: "separates provider availability, metric lineage, audited model output and chronological holdout evidence",
        historicalRating: "recent-results Elo-style research shadow using only completed events before the fixture",
        nhlXgGoalieShadow: "transparent Poisson H2H research model using independent xG rates and confirmed starting-goalie GSAx/60; optional post-shot xG is bounded at 20% of attack-rate input",
        soccerXgPoissonShadow: "transparent 1X2 Poisson research model using independent xGF/xGA rates per 90 with optional 20% post-shot xG blend",
        basketballEfficiencyShadow: "transparent NBA/WNBA H2H research model using pregame pace and offensive/defensive efficiency with optional bounded lineup impact",
        advancedModelHoldout: "latest immutable pregame capture per event/model is evaluated only after settlement; input snapshot hash is mandatory and no performance weight is invented",
        historicalDependencePolicy: "form/rest and historical rating share one historical-results-family top-level ensemble vote",
        advancedSignalDependencePolicy: "advanced xG models use the expected-performance family; basketball efficiency uses a separate performance-statistics lineage family; none share a market vote",
        performanceEvidence: "chronological pre-event holdout evidence is required before a performance weight can exist",
        ensembleEngine: "shadow-first independent-model ensemble; validated performance weights only",
        marketBenchmarkIsNotIndependentModel: true,
        rawAdvancedAnalyticsAutomaticallyCreateModelProbability: false,
        providerConfiguredMeansIndependentModelReady: false,
        nhlXgGoalieUsesMarketInputs: false,
        nhlXgGoalieRequiresStartingGoalies: true,
        soccerXgUsesMarketInputs: false,
        basketballEfficiencyUsesMarketInputs: false,
        holdoutInventsPerformanceWeight: false,
        featureOnlyModelsCastProbabilityVote: false,
        correlatedHistoricalModelsDoubleCounted: false,
        modelSelfDeclaredDependenceGroupTrusted: false,
        marketDerivedIndependentModelsAccepted: false,
        contextOnlyIndependentModelsAccepted: false,
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
        probabilityAdjustedByNhlXgGoalieShadow: false,
        probabilityAdjustedBySoccerXgPoissonShadow: false,
        probabilityAdjustedByBasketballEfficiencyShadow: false,
        probabilityAdjustedByModelFactory: false,
        probabilityAdjustedByAdvancedSignalReadiness: false,
        probabilityAdjustedByFeatureEnsemble: false,
        productionDecisionAdjustedByFeatureEnsemble: false,
        historicalRatingUsesPostFixtureResults: false,
        advancedModelsUsePostFixtureObservations: false,
        advancedModelsUseMarketProviderData: false,
        holdoutUsesResultDataOnlyAfterPredictionCapture: true,
        dependenceGroupDerivedFromLineage: true,
        marketDerivedSignalCanMasqueradeAsIndependentModel: false,
        rawAdvancedAnalyticsCanMasqueradeAsProbabilityModel: false,
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
