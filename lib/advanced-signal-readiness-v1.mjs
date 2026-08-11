import { canonicalSportFromKey } from "./sports-analytics-ingestion.mjs";

export const ADVANCED_SIGNAL_READINESS_VERSION = "scorecaster-advanced-signal-readiness-v1";

const FAMILY_ORDER = ["expected-performance", "performance-statistics", "tracking"];

const PROFILES = Object.freeze({
  ice_hockey: Object.freeze({
    expectedPerformance: ["xg", "post-shot-xg", "goals-saved-above-expected"],
    performanceStatistics: ["shots", "attempts", "special-teams"],
    tracking: ["puck-location", "skater-location", "goalie-lateral-movement"]
  }),
  soccer: Object.freeze({
    expectedPerformance: ["xg", "post-shot-xg", "xa"],
    performanceStatistics: ["shots", "possessions", "pressures"],
    tracking: ["player-locations", "ball-location", "team-shape"]
  }),
  basketball: Object.freeze({
    expectedPerformance: ["expected-points-per-shot", "shot-quality", "lineup-adjusted-impact"],
    performanceStatistics: ["pace", "offensive-rating", "defensive-rating"],
    tracking: ["player-location", "defender-distance", "spacing"]
  }),
  baseball: Object.freeze({
    expectedPerformance: ["xwoba", "expected-runs", "run-expectancy"],
    performanceStatistics: ["lineup-strength", "bullpen-depth", "platoon-profile"],
    tracking: ["pitch-flight", "ball-flight", "fielder-location"]
  }),
  tennis: Object.freeze({
    expectedPerformance: ["expected-point-win", "serve-quality", "return-quality"],
    performanceStatistics: ["serve-profile", "return-profile", "surface-profile"],
    tracking: ["serve-location", "shot-location", "court-coverage"]
  }),
  golf: Object.freeze({
    expectedPerformance: ["strokes-gained", "expected-proximity", "proximity-gained"],
    performanceStatistics: ["distance-profile", "proximity-profile", "dispersion-profile"],
    tracking: ["ball-flight", "carry", "dispersion"]
  })
});

function clean(value, limit = 140) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, limit);
}

function list(value, limit = 80) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => clean(item)).filter(Boolean))].slice(0, limit);
}

function profileFor(sport) {
  return PROFILES[sport] || Object.freeze({
    expectedPerformance: [],
    performanceStatistics: [],
    tracking: []
  });
}

function familyKey(family) {
  if (family === "expected-performance") return "expectedPerformance";
  if (family === "performance-statistics") return "performanceStatistics";
  return "tracking";
}

function modelRows(pick = {}) {
  const factory = pick.modelFactoryV1 || {};
  return Array.isArray(factory.outputs) ? factory.outputs : [];
}

function rejectedRows(pick = {}) {
  const factory = pick.modelFactoryV1 || {};
  return Array.isArray(factory.rejectedModels) ? factory.rejectedModels : [];
}

function matchesFamily(model = {}, family) {
  return Array.isArray(model?.signalLineageV1?.signalFamilies)
    && model.signalLineageV1.signalFamilies.includes(family);
}

function matchedRejectedModel(model = {}, family) {
  return Array.isArray(model?.signalFamilies) && model.signalFamilies.includes(family);
}

function coverage(metrics, anchors) {
  const values = list(metrics);
  const requested = list(anchors);
  if (!values.length) {
    return {
      source: "accepted-model-lineage",
      observed: false,
      required: requested.length,
      matched: 0,
      rate: null,
      matchedMetrics: [],
      missingMetrics: requested
    };
  }
  const available = new Set(values);
  const matched = requested.filter((metric) => available.has(metric));
  return {
    source: "accepted-model-lineage",
    observed: true,
    required: requested.length,
    matched: matched.length,
    rate: requested.length ? Number((matched.length / requested.length).toFixed(4)) : null,
    matchedMetrics: matched,
    missingMetrics: requested.filter((metric) => !available.has(metric))
  };
}

function stage({ providerConfigured, acceptedModels, rejectedModels, metricCoverage, calibrationReadyModels }) {
  if (calibrationReadyModels > 0) return "review-ready-shadow";
  if (acceptedModels > 0) return "shadow-model-needs-holdout";
  if (rejectedModels > 0) return "model-output-rejected";
  if (!providerConfigured) return "provider-not-configured";
  if (metricCoverage?.observed === true && metricCoverage.rate !== null && metricCoverage.rate < 0.67) return "provider-configured-metric-gap";
  return "provider-configured-model-missing";
}

function nextRequirement(status, family) {
  if (status === "review-ready-shadow") return "human-review-and-drift-monitoring";
  if (status === "shadow-model-needs-holdout") return "chronological-holdout-and-calibration-evidence";
  if (status === "model-output-rejected") return "fix-model-lineage-chronology-or-audit-errors";
  if (status === "provider-not-configured") return `configure-real-${family}-data-source-or-model-provider`;
  if (status === "provider-configured-metric-gap") return `increase-${family}-metric-coverage-before-modeling`;
  return `supply-audited-deterministic-${family}-probability-model-output`;
}

function familyReadiness(pick, providerConfiguration, profile, family) {
  const accepted = modelRows(pick).filter((model) => matchesFamily(model, family));
  const rejected = rejectedRows(pick).filter((model) => matchedRejectedModel(model, family));
  const lineageMetrics = accepted.flatMap((model) => model?.signalLineageV1?.metrics || []);
  const metricCoverage = coverage(lineageMetrics, profile[familyKey(family)]);
  const calibrationReady = accepted.filter((model) => model?.performanceEvidenceV1?.calibrationReady === true);
  const providerConfigured = providerConfiguration?.configured === true;
  const status = stage({
    providerConfigured,
    acceptedModels: accepted.length,
    rejectedModels: rejected.length,
    metricCoverage,
    calibrationReadyModels: calibrationReady.length
  });

  return {
    family,
    status,
    nextRequirement: nextRequirement(status, family),
    rawAnalyticsSourceConfigured: providerConfigured,
    rawAnalyticsSource: providerConfiguration?.source || null,
    auditedModelOutputCount: accepted.length,
    rejectedModelOutputCount: rejected.length,
    calibrationReadyModelCount: calibrationReady.length,
    dependenceGroups: [...new Set(accepted.map((model) => model.dependenceGroup).filter(Boolean))],
    modelIds: accepted.map((model) => model.modelId).filter(Boolean),
    rejectedModelIds: rejected.map((model) => model.modelId).filter(Boolean),
    metricCoverage,
    chronologyReady: accepted.length > 0 && accepted.every((model) => model?.audit?.chronologySafe === true),
    lineageReady: accepted.length > 0 && accepted.every((model) => Boolean(model?.signalLineageV1?.lineageFingerprint)),
    performanceEvidenceReady: calibrationReady.length > 0,
    probabilityModelPresent: accepted.length > 0,
    productionEligible: false
  };
}

export function buildAdvancedSignalReadinessV1(pick = {}, { providerConfiguration = {}, now = Date.now() } = {}) {
  const sportKey = pick.sportKey || pick.league || pick.sportTitle || "unknown";
  const sport = canonicalSportFromKey(sportKey);
  const profile = profileFor(sport);
  const families = FAMILY_ORDER.map((family) => familyReadiness(pick, providerConfiguration, profile, family));
  const modelReadyFamilies = families.filter((row) => row.probabilityModelPresent);
  const reviewReadyFamilies = families.filter((row) => row.status === "review-ready-shadow");
  const nextFamily = families.find((row) => row.status !== "review-ready-shadow") || null;

  return {
    version: ADVANCED_SIGNAL_READINESS_VERSION,
    sport,
    sportKey: clean(sportKey, 100) || null,
    generatedAt: new Date(now).toISOString(),
    rawAnalyticsProvider: {
      configured: providerConfiguration?.configured === true,
      source: providerConfiguration?.source || null,
      transport: providerConfiguration?.transport || "not-configured"
    },
    counts: {
      trackedFamilies: families.length,
      shadowModelReadyFamilies: modelReadyFamilies.length,
      reviewReadyFamilies: reviewReadyFamilies.length,
      calibrationNeededFamilies: families.filter((row) => row.status === "shadow-model-needs-holdout").length
    },
    families,
    nextPriority: nextFamily ? {
      family: nextFamily.family,
      status: nextFamily.status,
      requirement: nextFamily.nextRequirement
    } : null,
    contracts: {
      rawAnalyticsAutomaticallyConvertedToProbability: false,
      providerConfiguredMeansModelReady: false,
      rawMetricCoverageInferredWithoutModelLineage: false,
      modelOutputWithoutLineageAccepted: false,
      modelOutputWithoutChronologyAccepted: false,
      modelOutputWithoutHoldoutGetsPerformanceWeight: false,
      automaticPromotionAllowed: false,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      paperOnly: true
    }
  };
}

export const ADVANCED_SIGNAL_READINESS_PROFILES = PROFILES;
