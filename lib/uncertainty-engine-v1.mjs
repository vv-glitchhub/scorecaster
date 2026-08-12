export const UNCERTAINTY_ENGINE_VERSION = "scorecaster-uncertainty-engine-v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value, digits = 4) {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function addComponent(components, id, penalty, reasons = [], evidence = {}) {
  const safePenalty = clamp(Number(penalty) || 0, 0, 100);
  components.push({ id, penalty: safePenalty, reasons: [...new Set(reasons)], evidence });
  return safePenalty;
}

function dataQualityComponent(pick = {}) {
  const fusion = pick.intelligenceFusionV2 || {};
  const trust = finite(fusion?.trust?.score);
  const coverage = finite(fusion?.coverage?.coverageRate);
  const safeForAi = fusion?.dataQualityGate?.safeForAi;
  const reasons = [];
  let penalty = 0;

  if (safeForAi === false) {
    reasons.push("data-trust-gate-not-safe");
    penalty += 40;
  }
  if (trust === null) {
    reasons.push("data-trust-missing");
    penalty += 20;
  } else if (trust < 0.55) {
    reasons.push("data-trust-below-0.55");
    penalty += 25;
  } else if (trust < 0.7) {
    reasons.push("data-trust-below-0.70");
    penalty += 10;
  }

  if (coverage === null) {
    reasons.push("verified-data-coverage-missing");
    penalty += 20;
  } else if (coverage < 0.4) {
    reasons.push("verified-data-coverage-below-0.40");
    penalty += 25;
  } else if (coverage < 0.65) {
    reasons.push("verified-data-coverage-below-0.65");
    penalty += 10;
  }

  return {
    penalty: clamp(penalty, 0, 50),
    reasons,
    evidence: { trust: round(trust), coverage: round(coverage), safeForAi: safeForAi === true ? true : safeForAi === false ? false : null }
  };
}

function diversityComponent(ensemble = {}) {
  const groups = Math.max(0, Number(ensemble?.counts?.researchGroups || 0));
  if (groups < 2) return { penalty: 25, reasons: ["fewer-than-two-independent-model-groups"], evidence: { groups } };
  if (groups === 2) return { penalty: 5, reasons: ["minimum-independent-model-diversity-only"], evidence: { groups } };
  return { penalty: 0, reasons: [], evidence: { groups } };
}

function calibrationComponent(ensemble = {}) {
  const groups = Math.max(0, Number(ensemble?.counts?.calibrationReadyGroups || 0));
  const models = Array.isArray(ensemble?.models) ? ensemble.models : [];
  const ready = models.filter((row) => row?.eligibleForDecisionWeight === true);
  const maxCalibrationGap = ready.map((row) => finite(row?.performance?.calibrationGap)).filter((value) => value !== null).reduce((max, value) => Math.max(max, value), 0);
  const reasons = [];
  let penalty = 0;

  if (groups < 2) {
    reasons.push("fewer-than-two-calibration-ready-model-groups");
    penalty += 25;
  } else if (groups === 2) {
    reasons.push("minimum-calibration-ready-diversity-only");
    penalty += 5;
  }
  if (maxCalibrationGap > 0.08) {
    reasons.push("calibration-gap-above-0.08");
    penalty += 15;
  } else if (maxCalibrationGap > 0.05) {
    reasons.push("calibration-gap-above-0.05");
    penalty += 7;
  }

  return { penalty: clamp(penalty, 0, 35), reasons, evidence: { groups, maxCalibrationGap: round(maxCalibrationGap) } };
}

function disagreementComponent(ensemble = {}) {
  const uncertainty = ensemble?.uncertainty || {};
  const band = String(uncertainty.band || "unknown").toLowerCase();
  if (band === "high") return { penalty: 25, reasons: ["high-model-disagreement"], evidence: uncertainty };
  if (band === "medium") return { penalty: 10, reasons: ["medium-model-disagreement"], evidence: uncertainty };
  if (band === "unknown") return { penalty: 10, reasons: ["model-disagreement-unknown"], evidence: uncertainty };
  return { penalty: 0, reasons: [], evidence: uncertainty };
}

function rejectionComponent(featureEngine = {}, modelFactory = {}) {
  const featureRejected = Math.max(0, Number(featureEngine?.counts?.rejected || 0));
  const modelRejected = Math.max(0, Number(modelFactory?.counts?.rejectedOutputs || 0));
  const reasons = [];
  let penalty = 0;
  if (featureRejected > 0) {
    reasons.push("feature-inputs-rejected");
    penalty += Math.min(10, featureRejected * 2);
  }
  if (modelRejected > 0) {
    reasons.push("model-outputs-rejected");
    penalty += Math.min(10, modelRejected * 2);
  }
  return { penalty: clamp(penalty, 0, 15), reasons, evidence: { featureRejected, modelRejected } };
}

function marketComponent(ensemble = {}) {
  const probability = finite(ensemble?.marketBenchmark?.probability);
  if (probability === null) return { penalty: 10, reasons: ["market-benchmark-missing"], evidence: { probability: null } };
  return { penalty: 0, reasons: [], evidence: { probability: round(probability) } };
}

const CRITICAL_REASONS = new Set([
  "data-trust-gate-not-safe",
  "data-trust-missing",
  "verified-data-coverage-missing",
  "fewer-than-two-independent-model-groups",
  "fewer-than-two-calibration-ready-model-groups",
  "high-model-disagreement",
  "market-benchmark-missing"
]);

export function buildUncertaintyEngineV1(pick = {}, {
  featureEngine = pick.featureEngineV1 || {},
  modelFactory = pick.modelFactoryV1 || {},
  ensembleEngine = pick.ensembleEngineV1 || {},
  now = Date.now()
} = {}) {
  const components = [];
  let totalPenalty = 0;

  for (const [id, component] of [
    ["data-quality", dataQualityComponent(pick)],
    ["model-diversity", diversityComponent(ensembleEngine)],
    ["calibration", calibrationComponent(ensembleEngine)],
    ["model-disagreement", disagreementComponent(ensembleEngine)],
    ["rejections", rejectionComponent(featureEngine, modelFactory)],
    ["market-benchmark", marketComponent(ensembleEngine)]
  ]) {
    totalPenalty += addComponent(components, id, component.penalty, component.reasons, component.evidence);
  }

  const reasons = [...new Set(components.flatMap((component) => component.reasons))];
  const criticalReasons = reasons.filter((reason) => CRITICAL_REASONS.has(reason));
  const uncertaintyIndex = round(clamp(totalPenalty, 0, 100), 1);
  const evidenceReadiness = round(100 - uncertaintyIndex, 1);
  const band = criticalReasons.length > 0 || uncertaintyIndex >= 50
    ? "high"
    : uncertaintyIndex >= 25
      ? "medium"
      : "low";
  const researchDecision = criticalReasons.length > 0
    ? "NO_BET"
    : band === "medium"
      ? "CAUTION"
      : "REVIEW";

  return {
    version: UNCERTAINTY_ENGINE_VERSION,
    generatedAt: new Date(now).toISOString(),
    uncertaintyIndex,
    evidenceReadiness,
    band,
    researchDecision,
    blocked: researchDecision === "NO_BET",
    reasons,
    criticalReasons,
    components,
    contract: {
      indexIsHeuristicEvidenceRiskNotProbability: true,
      pseudoConfidenceIntervalPublished: false,
      missingTrustFailsClosed: true,
      missingCoverageFailsClosed: true,
      calibrationEvidenceRequired: true,
      modelDiversityRequired: true,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      automaticPromotionAllowed: false,
      paperOnly: true
    }
  };
}
