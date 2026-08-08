import { createHash } from "node:crypto";
import { TRANSPARENT_1X2_EVALUATION_PACKAGE_VERSION } from "./transparent-1x2-evaluation-package.mjs";

export const TRANSPARENT_1X2_PAIRED_EVIDENCE_VERSION = "scorecaster-transparent-1x2-paired-evidence-v4";

const clean = (value, maximum = 160) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

const fingerprint = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const validFingerprint = (value) => /^[0-9a-f]{64}$/i.test(String(value || ""));
const finite = (value) => value === null || value === undefined || value === ""
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const round = (value, digits = 9) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

function metricDirection(delta, epsilon = 1e-9) {
  if (!Number.isFinite(delta)) return "unavailable";
  if (Math.abs(delta) <= epsilon) return "tie";
  return delta < 0 ? "challenger-better" : "baseline-better";
}

function packageSummary(pkg = {}) {
  return {
    ok: pkg?.ok === true,
    version: clean(pkg?.version, 120) || null,
    packageId: validFingerprint(pkg?.packageId) ? String(pkg.packageId).toLowerCase() : null,
    datasetId: clean(pkg?.dataset?.datasetId, 160) || null,
    datasetKind: clean(pkg?.dataset?.datasetKind, 60) || null,
    cohortFingerprint: validFingerprint(pkg?.dataset?.cohortFingerprint) ? String(pkg.dataset.cohortFingerprint).toLowerCase() : null,
    predictionFingerprint: validFingerprint(pkg?.dataset?.predictionFingerprint) ? String(pkg.dataset.predictionFingerprint).toLowerCase() : null,
    datasetFingerprint: validFingerprint(pkg?.dataset?.datasetFingerprint) ? String(pkg.dataset.datasetFingerprint).toLowerCase() : null,
    sourceFingerprint: validFingerprint(pkg?.dataset?.sourceFingerprint) ? String(pkg.dataset.sourceFingerprint).toLowerCase() : null,
    configurationFingerprint: validFingerprint(pkg?.configurationFingerprint) ? String(pkg.configurationFingerprint).toLowerCase() : null,
    resultFingerprint: validFingerprint(pkg?.resultFingerprint) ? String(pkg.resultFingerprint).toLowerCase() : null,
    rowCount: finite(pkg?.dataset?.rowCount),
    marketBenchmarkType: clean(pkg?.dataset?.marketBenchmarkType, 80) || null,
    realHistoricalEvidence: pkg?.dataset?.realHistoricalEvidence === true,
    historicalValidationEligible: pkg?.evidenceAssessment?.canCountAsHistoricalValidation === true,
    automaticPromotionAllowed: pkg?.automaticPromotionAllowed === false,
    productionProbabilityChanged: pkg?.productionProbabilityChanged === false,
    paperOnly: pkg?.paperOnly === true,
    model: {
      samples: finite(pkg?.evaluation?.model?.samples),
      brier: finite(pkg?.evaluation?.model?.brier),
      logLoss: finite(pkg?.evaluation?.model?.logLoss)
    },
    marketBenchmark: {
      samples: finite(pkg?.evaluation?.marketBenchmark?.samples),
      brier: finite(pkg?.evaluation?.marketBenchmark?.brier),
      logLoss: finite(pkg?.evaluation?.marketBenchmark?.logLoss)
    },
    chronologicalFolds: Array.isArray(pkg?.evaluation?.chronologicalFolds)
      ? pkg.evaluation.chronologicalFolds.map((fold) => ({
          fold: finite(fold?.fold),
          trainingRows: finite(fold?.trainingRows),
          testRows: finite(fold?.testRows),
          trainingEndAt: clean(fold?.trainingEndAt, 64) || null,
          testStartAt: clean(fold?.testStartAt, 64) || null,
          testEndAt: clean(fold?.testEndAt, 64) || null,
          trainingChronologySafe: fold?.trainingChronologySafe === true,
          modelBrier: finite(fold?.metrics?.brier),
          modelLogLoss: finite(fold?.metrics?.logLoss),
          marketBrier: finite(fold?.marketBenchmark?.brier),
          marketLogLoss: finite(fold?.marketBenchmark?.logLoss)
        }))
      : []
  };
}

function foldIdentity(folds = []) {
  return folds.map((fold) => ({
    fold: fold.fold,
    trainingRows: fold.trainingRows,
    testRows: fold.testRows,
    trainingEndAt: fold.trainingEndAt,
    testStartAt: fold.testStartAt,
    testEndAt: fold.testEndAt,
    trainingChronologySafe: fold.trainingChronologySafe,
    marketBrier: fold.marketBrier,
    marketLogLoss: fold.marketLogLoss
  }));
}

function pairedFoldDeltas(baselineFolds = [], challengerFolds = []) {
  return baselineFolds.map((base, index) => {
    const challenger = challengerFolds[index] || {};
    const brierDelta = Number.isFinite(base.modelBrier) && Number.isFinite(challenger.modelBrier)
      ? round(challenger.modelBrier - base.modelBrier)
      : null;
    const logLossDelta = Number.isFinite(base.modelLogLoss) && Number.isFinite(challenger.modelLogLoss)
      ? round(challenger.modelLogLoss - base.modelLogLoss)
      : null;
    return {
      fold: base.fold,
      testRows: base.testRows,
      brierDelta,
      brierDirection: metricDirection(brierDelta),
      logLossDelta,
      logLossDirection: metricDirection(logLossDelta)
    };
  });
}

export function compareTransparent1X2EvaluationPackages({ baseline = {}, challenger = {} } = {}) {
  const base = packageSummary(baseline);
  const challenge = packageSummary(challenger);
  const failures = [];

  for (const [label, summary] of [["baseline", base], ["challenger", challenge]]) {
    if (!summary.ok) failures.push(`${label}-package-not-valid`);
    if (summary.version !== TRANSPARENT_1X2_EVALUATION_PACKAGE_VERSION) failures.push(`${label}-package-version-unsupported`);
    if (!summary.packageId) failures.push(`${label}-package-id-missing`);
    if (!summary.datasetFingerprint) failures.push(`${label}-dataset-fingerprint-missing`);
    if (!summary.predictionFingerprint) failures.push(`${label}-prediction-fingerprint-missing`);
    if (!summary.resultFingerprint) failures.push(`${label}-result-fingerprint-missing`);
    if (!summary.automaticPromotionAllowed || !summary.productionProbabilityChanged || !summary.paperOnly) failures.push(`${label}-safety-boundary-invalid`);
  }

  if (!base.datasetId || !challenge.datasetId || base.datasetId !== challenge.datasetId) failures.push("dataset-id-mismatch");
  if (!base.cohortFingerprint || !challenge.cohortFingerprint) failures.push("cohort-fingerprint-missing");
  if (base.cohortFingerprint && challenge.cohortFingerprint && base.cohortFingerprint !== challenge.cohortFingerprint) failures.push("cohort-mismatch");
  if (!base.configurationFingerprint || !challenge.configurationFingerprint) failures.push("configuration-fingerprint-missing");
  if (base.configurationFingerprint && challenge.configurationFingerprint && base.configurationFingerprint !== challenge.configurationFingerprint) failures.push("configuration-mismatch");
  if (base.rowCount === null || challenge.rowCount === null || base.rowCount !== challenge.rowCount) failures.push("row-count-mismatch");
  if (!base.sourceFingerprint || !challenge.sourceFingerprint || base.sourceFingerprint !== challenge.sourceFingerprint) failures.push("source-provenance-mismatch");
  if (!base.marketBenchmarkType || base.marketBenchmarkType !== challenge.marketBenchmarkType) failures.push("market-benchmark-type-mismatch");

  const marketIdentityMatches = base.marketBenchmark.samples !== null
    && base.marketBenchmark.brier !== null
    && base.marketBenchmark.logLoss !== null
    && base.marketBenchmark.samples === challenge.marketBenchmark.samples
    && base.marketBenchmark.brier === challenge.marketBenchmark.brier
    && base.marketBenchmark.logLoss === challenge.marketBenchmark.logLoss;
  if (!marketIdentityMatches) failures.push("market-benchmark-result-mismatch");

  const baseFoldIdentity = foldIdentity(base.chronologicalFolds);
  const challengerFoldIdentity = foldIdentity(challenge.chronologicalFolds);
  const foldsAligned = baseFoldIdentity.length > 0
    && challengerFoldIdentity.length > 0
    && fingerprint(baseFoldIdentity) === fingerprint(challengerFoldIdentity);
  if (!foldsAligned) failures.push("chronological-fold-mismatch");

  for (const [label, summary] of [["baseline", base], ["challenger", challenge]]) {
    if (summary.model.samples === null || summary.model.brier === null || summary.model.logLoss === null) failures.push(`${label}-model-metrics-missing`);
    if (summary.marketBenchmark.samples === null || summary.marketBenchmark.brier === null || summary.marketBenchmark.logLoss === null) failures.push(`${label}-market-metrics-missing`);
  }

  const uniqueFailures = [...new Set(failures)].sort();
  const comparable = uniqueFailures.length === 0;
  const predictionsDiffer = Boolean(base.predictionFingerprint && challenge.predictionFingerprint)
    && base.predictionFingerprint !== challenge.predictionFingerprint;
  const brierDelta = comparable ? round(challenge.model.brier - base.model.brier) : null;
  const logLossDelta = comparable ? round(challenge.model.logLoss - base.model.logLoss) : null;
  const foldDeltas = comparable ? pairedFoldDeltas(base.chronologicalFolds, challenge.chronologicalFolds) : [];
  const brierDirection = metricDirection(brierDelta);
  const logLossDirection = metricDirection(logLossDelta);
  const directionalVerdict = !comparable
    ? "not-comparable"
    : brierDirection === "challenger-better" && logLossDirection === "challenger-better"
      ? "challenger-directionally-better"
      : brierDirection === "baseline-better" && logLossDirection === "baseline-better"
        ? "baseline-directionally-better"
        : brierDirection === "tie" && logLossDirection === "tie"
          ? "directional-tie"
          : "mixed-directional-evidence";

  const realHistoricalPair = comparable
    && base.realHistoricalEvidence
    && challenge.realHistoricalEvidence
    && base.historicalValidationEligible
    && challenge.historicalValidationEligible;
  const evidenceLabel = !comparable
    ? "paired-evidence-invalid"
    : realHistoricalPair
      ? "paired-historical-evidence-ready-for-manual-review"
      : "paired-synthetic-or-insufficient-evidence-do-not-promote";

  const comparisonCore = {
    version: TRANSPARENT_1X2_PAIRED_EVIDENCE_VERSION,
    baselinePackageId: base.packageId,
    challengerPackageId: challenge.packageId,
    cohortFingerprint: comparable ? base.cohortFingerprint : null,
    configurationFingerprint: comparable ? base.configurationFingerprint : null,
    baselinePredictionFingerprint: base.predictionFingerprint,
    challengerPredictionFingerprint: challenge.predictionFingerprint,
    predictionsDiffer,
    rowCount: comparable ? base.rowCount : null,
    marketBenchmark: comparable ? base.marketBenchmark : null,
    metrics: {
      baseline: base.model,
      challenger: challenge.model,
      deltaChallengerMinusBaseline: {
        brier: brierDelta,
        logLoss: logLossDelta
      },
      direction: {
        brier: brierDirection,
        logLoss: logLossDirection,
        overall: directionalVerdict
      }
    },
    chronologicalFoldDeltas: foldDeltas,
    comparable,
    failures: uniqueFailures,
    evidenceAssessment: {
      realHistoricalPair,
      readyForManualReview: realHistoricalPair,
      label: evidenceLabel,
      statisticalSignificanceClaimed: false,
      automaticPromotionAllowed: false
    }
  };

  return {
    ok: comparable,
    ...comparisonCore,
    comparisonId: fingerprint(comparisonCore),
    provenance: {
      sameCohortRequired: true,
      sameConfigurationRequired: true,
      samePredictionTimeMarketBenchmarkRequired: true,
      sameChronologicalFoldsRequired: true,
      rawEvaluationRowsIncluded: false,
      personalDataIncluded: false,
      restrictedRawPayloadIncluded: false
    },
    automaticPromotionAllowed: false,
    productionProbabilityChanged: false,
    paperOnly: true
  };
}
