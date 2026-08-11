export const MODEL_PERFORMANCE_EVIDENCE_VERSION = "scorecaster-model-performance-evidence-v1";

const MIN_DECISION_SAMPLE = 100;
const FUTURE_SKEW_MS = 60_000;
const ALLOWED_WEIGHT_SOURCES = new Set([
  "validated-calibration-slice",
  "shadow-learning-holdout",
  "chronological-holdout"
]);
const ALLOWED_EVALUATION_MODES = new Set([
  "chronological-holdout",
  "walk-forward",
  "rolling-origin"
]);
const ALLOWED_STATUSES = new Set([
  "insufficient",
  "research",
  "review-ready",
  "validated",
  "usable",
  "promotion-ready"
]);

const clean = (value, limit = 180) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value, digits = 6) => {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
};

const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const time = (value) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
};

function scopeOf(raw = {}) {
  const scope = raw.scope && typeof raw.scope === "object" ? raw.scope : {};
  return {
    sport: clean(scope.sport || raw.sport, 80).toLowerCase() || "unknown",
    league: clean(scope.league || raw.league, 120).toLowerCase() || "unknown",
    market: clean(scope.market || raw.market, 80).toLowerCase() || "unknown"
  };
}

export function buildModelPerformanceEvidenceV1(raw = {}, {
  modelId,
  modelVersion,
  dependenceGroup,
  predictionHorizon,
  now = Date.now()
} = {}) {
  const resolvedModelId = clean(raw.modelId || modelId, 160);
  const resolvedModelVersion = clean(raw.modelVersion || modelVersion || resolvedModelId, 160);
  const resolvedDependenceGroup = clean(raw.dependenceGroup || raw.modelFamily || dependenceGroup || resolvedModelId, 160).toLowerCase();
  const status = clean(raw.status || raw.sampleState, 40).toLowerCase() || "insufficient";
  const evaluationMode = clean(raw.evaluationMode || raw.validationMode, 60).toLowerCase();
  const weightSource = clean(raw.weightSource || raw.weight_source, 80).toLowerCase();
  const sampleSize = Math.max(0, Math.trunc(finite(raw.sampleSize ?? raw.sample_size) || 0));
  const performanceWeight = finite(raw.performanceWeight ?? raw.performance_weight ?? raw.weight);
  const evaluatedAt = iso(raw.evaluatedAt || raw.generatedAt);
  const trainingCutoff = iso(raw.trainingCutoff || raw.training_cutoff);
  const testStart = iso(raw.testStart || raw.holdoutStart || raw.test_start);
  const testEnd = iso(raw.testEnd || raw.holdoutEnd || raw.test_end);
  const horizon = time(predictionHorizon);
  const errors = [];

  const brier = finite(raw.brier ?? raw.brierScore);
  const logLoss = finite(raw.logLoss ?? raw.log_loss);
  const calibrationGap = finite(raw.calibrationGap ?? raw.calibration_gap);
  const baselineBrierDelta = finite(raw.baselineBrierDelta ?? raw.deltaBrierVsBaseline);
  const baselineLogLossDelta = finite(raw.baselineLogLossDelta ?? raw.deltaLogLossVsBaseline);

  if (!resolvedModelId) errors.push("missing-model-id");
  if (!resolvedModelVersion) errors.push("missing-model-version");
  if (!resolvedDependenceGroup) errors.push("missing-dependence-group");
  if (!ALLOWED_STATUSES.has(status)) errors.push("unsupported-performance-status");
  if (evaluationMode && !ALLOWED_EVALUATION_MODES.has(evaluationMode)) errors.push("unsupported-evaluation-mode");
  if (weightSource && !ALLOWED_WEIGHT_SOURCES.has(weightSource)) errors.push("unsupported-weight-source");
  if (performanceWeight !== null && (performanceWeight <= 0 || performanceWeight > 10)) errors.push("invalid-performance-weight");
  if (brier !== null && (brier < 0 || brier > 1)) errors.push("invalid-brier-score");
  if (logLoss !== null && logLoss < 0) errors.push("invalid-log-loss");
  if (calibrationGap !== null && (calibrationGap < 0 || calibrationGap > 1)) errors.push("invalid-calibration-gap");
  if (evaluatedAt && time(evaluatedAt) > now + FUTURE_SKEW_MS) errors.push("evaluation-from-future");
  if (trainingCutoff && horizon !== null && time(trainingCutoff) > horizon + FUTURE_SKEW_MS) errors.push("training-cutoff-after-prediction-horizon");
  if (testStart && trainingCutoff && time(trainingCutoff) > time(testStart)) errors.push("training-overlaps-holdout");
  if (testStart && testEnd && time(testStart) >= time(testEnd)) errors.push("invalid-holdout-window");
  if (testEnd && evaluatedAt && time(testEnd) > time(evaluatedAt) + FUTURE_SKEW_MS) errors.push("evaluation-before-holdout-end");
  if (raw.preEventOnly === false || raw.closingLineLeakage === true || raw.postEventDataUsed === true) errors.push("leakage-boundary-violated");

  const chronologySafe = !errors.some((item) => [
    "evaluation-from-future",
    "training-cutoff-after-prediction-horizon",
    "training-overlaps-holdout",
    "invalid-holdout-window",
    "evaluation-before-holdout-end",
    "leakage-boundary-violated"
  ].includes(item));

  const validatedMode = ALLOWED_EVALUATION_MODES.has(evaluationMode);
  const validatedStatus = ["review-ready", "validated", "usable", "promotion-ready"].includes(status);
  const validatedWeightSource = ALLOWED_WEIGHT_SOURCES.has(weightSource);
  const metricsPresent = brier !== null && logLoss !== null && calibrationGap !== null;
  const calibrationReady = errors.length === 0
    && chronologySafe
    && sampleSize >= MIN_DECISION_SAMPLE
    && validatedMode
    && validatedStatus
    && validatedWeightSource
    && performanceWeight !== null
    && performanceWeight > 0
    && metricsPresent
    && raw.preEventOnly === true
    && raw.closingLineLeakage !== true
    && raw.postEventDataUsed !== true;

  const scope = scopeOf(raw);
  const value = {
    version: MODEL_PERFORMANCE_EVIDENCE_VERSION,
    modelId: resolvedModelId,
    modelVersion: resolvedModelVersion,
    dependenceGroup: resolvedDependenceGroup,
    scope,
    status,
    evaluationMode: evaluationMode || null,
    sampleSize,
    performanceWeight: performanceWeight === null ? null : round(performanceWeight),
    weightSource: weightSource || null,
    evaluatedAt,
    trainingCutoff,
    testStart,
    testEnd,
    brier: round(brier),
    logLoss: round(logLoss),
    calibrationGap: round(calibrationGap),
    baselineBrierDelta: round(baselineBrierDelta),
    baselineLogLossDelta: round(baselineLogLossDelta),
    preEventOnly: raw.preEventOnly === true,
    closingLineLeakage: raw.closingLineLeakage === true,
    postEventDataUsed: raw.postEventDataUsed === true,
    chronologySafe,
    calibrationReady,
    paperOnly: true
  };

  return {
    ok: errors.length === 0,
    value,
    errors: [...new Set(errors)].sort(),
    calibrationReady,
    ensemblePerformance: {
      status: calibrationReady ? "validated" : status,
      sampleSize,
      performanceWeight: calibrationReady ? round(performanceWeight) : null,
      weightSource: calibrationReady ? weightSource : null,
      evaluatedAt,
      trainingCutoff,
      brier: round(brier),
      logLoss: round(logLoss),
      calibrationGap: round(calibrationGap)
    },
    automaticPromotionAllowed: false,
    productionProbabilityChanged: false,
    paperOnly: true
  };
}

export const MODEL_PERFORMANCE_MIN_DECISION_SAMPLE = MIN_DECISION_SAMPLE;
