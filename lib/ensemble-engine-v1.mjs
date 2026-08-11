export const ENSEMBLE_ENGINE_VERSION = "scorecaster-ensemble-engine-v1";

const FUTURE_SKEW_MS = 60_000;
const HIGH_DISAGREEMENT = 0.08;
const MEDIUM_DISAGREEMENT = 0.04;
const MIN_DECISION_SAMPLE = 100;

const BANNED_MODEL_PATTERNS = [
  "model-engine-v3",
  "legacy-random",
  "random-model",
  "math.random"
];

function clean(value, limit = 180) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function probability(value) {
  const number = finite(value);
  return number !== null && number > 0 && number < 1 ? number : null;
}

function round(value, digits = 6) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function iso(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function eventHorizon(pick, now) {
  const commence = timestamp(pick.commenceTime || pick.commence_time);
  return commence === null ? now : Math.min(now, commence);
}

function modelIsBanned(id) {
  const normalized = clean(id, 220).toLowerCase();
  return BANNED_MODEL_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function selectionSide(pick = {}) {
  const ledgerSide = clean(pick?.unifiedSportsData?.selectionSide, 20).toLowerCase();
  if (["home", "draw", "away"].includes(ledgerSide)) return ledgerSide;
  const selection = clean(pick.selection || pick.label, 160).toLowerCase();
  const home = clean(pick.homeTeam, 160).toLowerCase();
  const away = clean(pick.awayTeam, 160).toLowerCase();
  if (selection && home && (selection === home || selection.includes(home))) return "home";
  if (selection && away && (selection === away || selection.includes(away))) return "away";
  if (selection.includes("draw") || selection.includes("tasapeli")) return "draw";
  return null;
}

function transparentCandidate(pick = {}) {
  const model = pick.transparent1x2V2 || pick.transparent1x2 || pick.transparentModel || null;
  const side = selectionSide(pick);
  const selectedProbability = side ? probability(model?.probabilities?.[side] ?? model?.productionProbabilities?.[side]) : null;
  if (!model || model.ok !== true || selectedProbability === null) return null;
  return {
    modelId: model.modelVersion || model.baselineModelVersion || "transparent-1x2",
    modelVersion: model.modelVersion || model.baselineModelVersion || "transparent-1x2",
    probability: selectedProbability,
    generatedAt: model.generatedAt,
    audit: {
      independentPredictiveModel: true,
      deterministic: true,
      chronologySafe: true,
      source: "transparent-1x2-engine"
    },
    performance: model.performance || model.calibrationEvidence || null,
    role: "independent-baseline"
  };
}

function explicitProbabilityCandidate(pick = {}) {
  const audit = pick.independentModelAudit;
  const p = probability(pick.independentModelProbability);
  if (p === null || !audit || typeof audit !== "object") return null;
  return {
    modelId: audit.modelId || audit.modelVersion || "explicit-independent-model",
    modelVersion: audit.modelVersion || audit.modelId || "explicit-independent-model",
    probability: p,
    generatedAt: audit.generatedAt || pick.generatedAt,
    trainingCutoff: audit.trainingCutoff,
    audit,
    performance: audit.performance || pick.independentModelPerformance || null,
    role: "independent-model"
  };
}

function rawCandidates(pick = {}) {
  const rows = [
    ...(Array.isArray(pick.independentModelOutputs) ? pick.independentModelOutputs : []),
    ...(Array.isArray(pick.modelOutputsV1) ? pick.modelOutputsV1 : [])
  ];
  const transparent = transparentCandidate(pick);
  const explicit = explicitProbabilityCandidate(pick);
  if (transparent) rows.push(transparent);
  if (explicit) rows.push(explicit);
  return rows.slice(0, 30);
}

function performanceEvidence(candidate = {}, now, predictionHorizon) {
  const performance = candidate.performance && typeof candidate.performance === "object" ? candidate.performance : {};
  const sampleSize = Math.max(0, Math.trunc(finite(performance.sampleSize ?? performance.sample_size) || 0));
  const status = clean(performance.status || performance.sampleState || performance.sample_state, 40).toLowerCase();
  const suppliedWeight = finite(performance.performanceWeight ?? performance.performance_weight ?? performance.weight);
  const weightSource = clean(performance.weightSource || performance.weight_source, 80).toLowerCase();
  const evaluatedAt = iso(performance.evaluatedAt || performance.generatedAt);
  const trainingCutoff = iso(performance.trainingCutoff || candidate.trainingCutoff || candidate.audit?.trainingCutoff);
  const brier = finite(performance.brier ?? performance.brierScore);
  const logLoss = finite(performance.logLoss ?? performance.log_loss);
  const calibrationGap = finite(performance.calibrationGap ?? performance.calibration_gap);
  const chronologySafe = (!evaluatedAt || (timestamp(evaluatedAt) || 0) <= now + FUTURE_SKEW_MS)
    && (!trainingCutoff || (timestamp(trainingCutoff) || 0) <= predictionHorizon + FUTURE_SKEW_MS);
  const validatedStatus = ["usable", "validated", "promotion-ready", "review-ready"].includes(status);
  const validatedWeightSource = ["validated-calibration-slice", "shadow-learning-holdout", "chronological-holdout"].includes(weightSource);
  const calibrationReady = chronologySafe
    && sampleSize >= MIN_DECISION_SAMPLE
    && validatedStatus
    && validatedWeightSource
    && suppliedWeight !== null
    && suppliedWeight > 0;

  return {
    sampleSize,
    status: status || "unvalidated",
    performanceWeight: suppliedWeight === null ? null : round(Math.max(0, Math.min(10, suppliedWeight)), 6),
    weightSource: weightSource || null,
    evaluatedAt,
    trainingCutoff,
    brier: brier === null ? null : round(brier),
    logLoss: logLoss === null ? null : round(logLoss),
    calibrationGap: calibrationGap === null ? null : round(calibrationGap),
    chronologySafe,
    calibrationReady
  };
}

function normalizeCandidate(candidate = {}, pick = {}, now = Date.now()) {
  const id = clean(candidate.modelId || candidate.modelVersion || candidate.id || candidate.name, 180) || "unknown-model";
  const version = clean(candidate.modelVersion || candidate.version || id, 180) || id;
  const p = probability(candidate.probability ?? candidate.modelProbability);
  const audit = candidate.audit && typeof candidate.audit === "object" ? candidate.audit : {};
  const independent = candidate.independentPredictiveModel === true || audit.independentPredictiveModel === true;
  const deterministic = candidate.deterministic === true || audit.deterministic === true;
  const generatedAt = iso(candidate.generatedAt || audit.generatedAt);
  const horizon = eventHorizon(pick, now);
  const generatedTimestamp = timestamp(generatedAt);
  const chronologySafe = audit.chronologySafe !== false && (generatedTimestamp === null || generatedTimestamp <= horizon + FUTURE_SKEW_MS);
  const reasons = [];

  if (p === null) reasons.push("invalid-probability");
  if (!independent) reasons.push("not-independent-predictive-model");
  if (!deterministic) reasons.push("not-deterministic");
  if (!chronologySafe) reasons.push("prediction-chronology-violation");
  if (modelIsBanned(`${id} ${version} ${audit.implementationPath || ""}`)) reasons.push("banned-random-or-legacy-model");

  const performance = performanceEvidence(candidate, now, horizon);
  if (!performance.chronologySafe) reasons.push("performance-evidence-chronology-violation");
  const eligibleForResearch = reasons.length === 0;
  const researchWeight = eligibleForResearch
    ? performance.calibrationReady ? performance.performanceWeight : 1
    : 0;

  return {
    modelId: id,
    modelVersion: version,
    role: clean(candidate.role, 60) || "independent-model",
    probability: p === null ? null : round(p),
    generatedAt,
    independentPredictiveModel: independent,
    deterministic,
    chronologySafe,
    eligibleForResearch,
    eligibleForDecisionWeight: eligibleForResearch && performance.calibrationReady,
    researchWeight: round(researchWeight),
    performance,
    rejectionReasons: reasons,
    auditSource: clean(audit.source || candidate.source, 120) || null
  };
}

function weightedMean(rows, useDecisionWeights = false) {
  const eligible = rows.filter((row) => useDecisionWeights ? row.eligibleForDecisionWeight : row.eligibleForResearch);
  if (!eligible.length) return null;
  const weighted = eligible.map((row) => ({
    ...row,
    weight: useDecisionWeights ? row.performance.performanceWeight : row.researchWeight
  })).filter((row) => finite(row.weight) !== null && row.weight > 0);
  const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  if (!totalWeight) return null;
  return {
    probability: weighted.reduce((sum, row) => sum + row.probability * row.weight, 0) / totalWeight,
    totalWeight,
    rows: weighted
  };
}

function disagreement(rows, center) {
  const eligible = rows.filter((row) => row.eligibleForResearch && row.probability !== null);
  if (!eligible.length || center === null) {
    return { standardDeviation: null, range: null, band: "unknown", minimum: null, maximum: null };
  }
  const weights = eligible.map((row) => row.researchWeight || 1);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const variance = eligible.reduce((sum, row, index) => sum + weights[index] * ((row.probability - center) ** 2), 0) / total;
  const minimum = Math.min(...eligible.map((row) => row.probability));
  const maximum = Math.max(...eligible.map((row) => row.probability));
  const standardDeviation = Math.sqrt(Math.max(0, variance));
  return {
    standardDeviation: round(standardDeviation),
    range: round(maximum - minimum),
    minimum: round(minimum),
    maximum: round(maximum),
    band: standardDeviation >= HIGH_DISAGREEMENT ? "high" : standardDeviation >= MEDIUM_DISAGREEMENT ? "medium" : "low"
  };
}

function marketBenchmark(pick = {}) {
  const p = probability(pick.marketProbability ?? pick.consensusProbability);
  return {
    probability: p === null ? null : round(p),
    source: "no-vig-market-consensus",
    independentPredictiveModel: false
  };
}

function performanceKey(pick = {}) {
  return [
    clean(pick.sportKey || pick.sportTitle || "unknown", 80).toLowerCase(),
    clean(pick.leagueTitle || pick.league || "unknown", 100).toLowerCase(),
    clean(pick.market || pick.marketKey || "h2h", 60).toLowerCase()
  ].join("|");
}

export function buildEnsembleSnapshotV1(pick = {}, featureSnapshot = null, { now = Date.now() } = {}) {
  const candidates = rawCandidates(pick).map((row) => normalizeCandidate(row, pick, now));
  const research = candidates.filter((row) => row.eligibleForResearch);
  const decisionWeighted = candidates.filter((row) => row.eligibleForDecisionWeight);
  const shadow = weightedMean(candidates, false);
  const calibratedShadow = weightedMean(candidates, true);
  const shadowProbability = shadow ? round(shadow.probability) : null;
  const calibratedShadowProbability = calibratedShadow && decisionWeighted.length >= 2 ? round(calibratedShadow.probability) : null;
  const uncertainty = disagreement(candidates, shadowProbability);
  const benchmark = marketBenchmark(pick);
  const fusion = pick.intelligenceFusionV2 || {};
  const fusionTrust = finite(fusion?.trust?.score);
  const fusionCoverage = finite(fusion?.coverage?.coverageRate);
  const featureRejected = Number(featureSnapshot?.counts?.rejected || 0);
  const riskReasons = [];

  if (fusion?.dataQualityGate?.safeForAi === false) riskReasons.push("data-trust-gate-not-safe");
  if (fusionTrust !== null && fusionTrust < 0.55) riskReasons.push("data-trust-below-0.55");
  if (fusionCoverage !== null && fusionCoverage < 0.4) riskReasons.push("verified-data-coverage-below-0.40");
  if (featureRejected > 0) riskReasons.push("future-dated-feature-rejected");
  if (research.length < 2) riskReasons.push("fewer-than-two-independent-models");
  if (uncertainty.band === "high") riskReasons.push("high-model-disagreement");
  if (decisionWeighted.length < 2) riskReasons.push("fewer-than-two-calibration-ready-models");

  const promotionEligible = riskReasons.length === 0
    && decisionWeighted.length >= 2
    && uncertainty.band === "low"
    && calibratedShadowProbability !== null;

  return {
    version: ENSEMBLE_ENGINE_VERSION,
    generatedAt: new Date(now).toISOString(),
    performanceSliceKey: performanceKey(pick),
    marketBenchmark: benchmark,
    models: candidates,
    counts: {
      supplied: candidates.length,
      researchEligible: research.length,
      calibrationReady: decisionWeighted.length,
      rejected: candidates.filter((row) => !row.eligibleForResearch).length
    },
    shadowProbability,
    calibratedShadowProbability,
    shadowEdgeVsMarket: shadowProbability !== null && benchmark.probability !== null ? round(shadowProbability - benchmark.probability) : null,
    calibratedShadowEdgeVsMarket: calibratedShadowProbability !== null && benchmark.probability !== null ? round(calibratedShadowProbability - benchmark.probability) : null,
    uncertainty,
    researchRiskGate: {
      decision: riskReasons.length ? "NO_BET" : "REVIEW",
      blocked: riskReasons.length > 0,
      reasons: riskReasons,
      productionDecisionChanged: false
    },
    promotion: {
      eligibleForHumanReview: promotionEligible,
      automaticPromotionAllowed: false,
      minimumDecisionSamplePerWeightedModel: MIN_DECISION_SAMPLE,
      requiresValidatedPerformanceWeights: true,
      requiresAtLeastTwoIndependentModels: true
    },
    weighting: {
      researchMode: "equal-weight unless a validated calibration slice supplies an explicit weight",
      decisionWeightSourceAllowlist: ["validated-calibration-slice", "shadow-learning-holdout", "chronological-holdout"],
      inventedPerformanceWeights: false
    },
    contract: {
      productionProbabilityChanged: false,
      marketBenchmarkIncludedAsIndependentModel: false,
      randomLegacyModelsAccepted: false,
      contextModelsMayMasqueradeAsIndependentModels: false,
      missingModelOutputsImputed: false,
      paperOnly: true
    }
  };
}
