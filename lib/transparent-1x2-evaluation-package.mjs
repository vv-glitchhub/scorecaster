import { createHash } from "node:crypto";
import { evaluateTransparent1X2Backtest } from "./transparent-1x2-validation.mjs";

export const TRANSPARENT_1X2_EVALUATION_PACKAGE_VERSION = "scorecaster-transparent-1x2-evaluation-package-v3";

const ALLOWED_DATASET_KINDS = new Set(["historical-observations", "synthetic-fixture"]);
const ALLOWED_RIGHTS = new Set(["reviewed", "synthetic"]);
const ALLOWED_ROW_FIELDS = new Set([
  "id",
  "predictedAt",
  "kickoffAt",
  "trainingCutoff",
  "marketObservedAt",
  "outcomeObservedAt",
  "probabilities",
  "marketProbabilities",
  "outcome",
  "league",
  "season",
  "market",
  "provider",
  "decisionClass",
  "modelVersion"
]);

const clean = (value, maximum = 160) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

const fingerprint = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

function probabilityMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = {};
  for (const key of ["home", "draw", "away"]) {
    const number = Number(value[key]);
    if (!Number.isFinite(number) || number <= 0 || number >= 1) return null;
    parsed[key] = number;
  }
  const total = parsed.home + parsed.draw + parsed.away;
  if (!Number.isFinite(total) || Math.abs(total - 1) > 0.01) return null;
  return Object.fromEntries(["home", "draw", "away"].map((key) => [
    key,
    Number((parsed[key] / total).toFixed(9))
  ]));
}

function normalizeManifest(manifest = {}) {
  const datasetId = clean(manifest.datasetId, 160);
  const datasetKind = clean(manifest.datasetKind, 40).toLowerCase();
  const createdAt = iso(manifest.createdAt);
  const dataCutoff = iso(manifest.dataCutoff);
  const rightsStatus = clean(manifest.rightsStatus, 40).toLowerCase();
  const marketBenchmarkType = clean(manifest.marketBenchmarkType, 80).toLowerCase();
  const sourceIds = Array.isArray(manifest.sourceIds)
    ? [...new Set(manifest.sourceIds.map((item) => clean(item, 120)).filter(Boolean))].sort()
    : [];
  const errors = [];

  if (Number(manifest.schemaVersion) !== 1) errors.push("invalid-dataset-schema-version");
  if (!datasetId) errors.push("missing-dataset-id");
  if (!ALLOWED_DATASET_KINDS.has(datasetKind)) errors.push("invalid-dataset-kind");
  if (!createdAt) errors.push("missing-dataset-created-at");
  if (!dataCutoff) errors.push("missing-data-cutoff");
  if (createdAt && dataCutoff && Date.parse(createdAt) < Date.parse(dataCutoff)) errors.push("dataset-created-before-data-cutoff");
  if (!ALLOWED_RIGHTS.has(rightsStatus)) errors.push("invalid-rights-status");
  if (datasetKind === "historical-observations" && rightsStatus !== "reviewed") errors.push("historical-rights-not-reviewed");
  if (datasetKind === "synthetic-fixture" && rightsStatus !== "synthetic") errors.push("synthetic-rights-status-required");
  if (!sourceIds.length) errors.push("missing-source-provenance");
  if (manifest.containsPersonalData !== false) errors.push("personal-data-boundary-not-confirmed");
  if (manifest.containsRestrictedRawPayload !== false) errors.push("restricted-payload-boundary-not-confirmed");
  if (marketBenchmarkType !== "no-vig-prediction-time") errors.push("invalid-market-benchmark-type");

  return {
    errors,
    value: {
      schemaVersion: 1,
      datasetId,
      datasetKind,
      createdAt,
      dataCutoff,
      rightsStatus,
      marketBenchmarkType,
      sourceIds,
      containsPersonalData: false,
      containsRestrictedRawPayload: false
    }
  };
}

function normalizeRow(row = {}, index = 0) {
  const errors = [];
  const unexpected = Object.keys(row).filter((key) => !ALLOWED_ROW_FIELDS.has(key)).sort();
  if (unexpected.length) errors.push(...unexpected.map((key) => `unexpected-row-field:${key}`));

  const id = clean(row.id, 160) || `row-${index}`;
  const predictedAt = iso(row.predictedAt);
  const kickoffAt = iso(row.kickoffAt);
  const trainingCutoff = iso(row.trainingCutoff);
  const marketObservedAt = iso(row.marketObservedAt);
  const outcomeObservedAt = iso(row.outcomeObservedAt);
  const modelProbabilities = probabilityMap(row.probabilities);
  const marketProbabilities = probabilityMap(row.marketProbabilities);

  if (!clean(row.id, 160)) errors.push("missing-row-id");
  if (!predictedAt) errors.push("missing-prediction-time");
  if (!kickoffAt) errors.push("missing-kickoff-time");
  if (!trainingCutoff) errors.push("missing-training-cutoff");
  if (!outcomeObservedAt) errors.push("missing-outcome-observed-time");
  if (!modelProbabilities) errors.push("invalid-model-probabilities");
  if (!marketProbabilities) errors.push("invalid-market-probabilities");
  if (marketProbabilities && !marketObservedAt) errors.push("missing-market-observed-time");
  if (predictedAt && kickoffAt && Date.parse(predictedAt) >= Date.parse(kickoffAt)) errors.push("prediction-not-prestart");
  if (trainingCutoff && predictedAt && Date.parse(trainingCutoff) > Date.parse(predictedAt)) errors.push("training-cutoff-after-prediction");
  if (marketObservedAt && predictedAt && Date.parse(marketObservedAt) > Date.parse(predictedAt)) errors.push("market-observed-after-prediction");
  if (outcomeObservedAt && kickoffAt && Date.parse(outcomeObservedAt) <= Date.parse(kickoffAt)) errors.push("outcome-observed-not-after-kickoff");

  const outcome = clean(row.outcome, 12).toLowerCase();
  if (!["home", "draw", "away"].includes(outcome)) errors.push("invalid-outcome");

  return {
    errors,
    value: {
      id,
      predictedAt,
      kickoffAt,
      trainingCutoff,
      marketObservedAt,
      outcomeObservedAt,
      probabilities: modelProbabilities,
      marketProbabilities,
      outcome,
      league: clean(row.league, 120) || "unknown",
      season: clean(row.season, 80) || "unknown",
      market: clean(row.market, 60) || "h2h",
      provider: clean(row.provider, 100) || "unknown",
      decisionClass: clean(row.decisionClass, 40).toUpperCase() || "UNKNOWN",
      modelVersion: clean(row.modelVersion, 120) || "unknown"
    }
  };
}

function evaluationOptions(options = {}, generatedAt) {
  return {
    generatedAt,
    minimumSample: Math.max(10, Math.trunc(Number(options.minimumSample) || 100)),
    minimumTrain: Math.max(1, Math.trunc(Number(options.minimumTrain) || 50)),
    testWindow: Math.max(1, Math.trunc(Number(options.testWindow) || 25)),
    binCount: Math.max(5, Math.min(20, Math.trunc(Number(options.binCount) || 10)))
  };
}

function cohortRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    predictedAt: row.predictedAt,
    kickoffAt: row.kickoffAt,
    marketObservedAt: row.marketObservedAt,
    outcomeObservedAt: row.outcomeObservedAt,
    marketProbabilities: row.marketProbabilities,
    outcome: row.outcome,
    league: row.league,
    season: row.season,
    market: row.market,
    provider: row.provider
  }));
}

function predictionRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    predictedAt: row.predictedAt,
    trainingCutoff: row.trainingCutoff,
    probabilities: row.probabilities,
    decisionClass: row.decisionClass,
    modelVersion: row.modelVersion
  }));
}

export function buildTransparent1X2EvaluationPackage({ manifest = {}, records = [], options = {} } = {}) {
  const normalizedManifest = normalizeManifest(manifest);
  const rowResults = (Array.isArray(records) ? records : []).map(normalizeRow);
  const errors = [...normalizedManifest.errors];
  const seen = new Set();

  for (const row of rowResults) {
    errors.push(...row.errors);
    if (seen.has(row.value.id)) errors.push("duplicate-row-id");
    seen.add(row.value.id);
  }

  const rows = rowResults.map((item) => item.value);
  const dataCutoff = normalizedManifest.value.dataCutoff;
  if (dataCutoff && rows.some((row) => row.outcomeObservedAt && Date.parse(row.outcomeObservedAt) > Date.parse(dataCutoff))) {
    errors.push("row-outcome-after-data-cutoff");
  }
  if (!rows.length) errors.push("empty-evaluation-dataset");

  const uniqueErrors = [...new Set(errors)].sort();
  const sourceFingerprint = fingerprint(normalizedManifest.value.sourceIds);
  const sharedDatasetIdentity = {
    schemaVersion: 1,
    datasetId: normalizedManifest.value.datasetId,
    datasetKind: normalizedManifest.value.datasetKind,
    createdAt: normalizedManifest.value.createdAt,
    dataCutoff: normalizedManifest.value.dataCutoff,
    rightsStatus: normalizedManifest.value.rightsStatus,
    marketBenchmarkType: normalizedManifest.value.marketBenchmarkType,
    sourceFingerprint
  };
  const cohortFingerprint = fingerprint({
    ...sharedDatasetIdentity,
    rows: cohortRows(rows)
  });
  const predictionFingerprint = fingerprint({
    datasetId: normalizedManifest.value.datasetId,
    cohortFingerprint,
    rows: predictionRows(rows)
  });
  const datasetFingerprint = fingerprint({
    ...sharedDatasetIdentity,
    rows
  });
  const config = evaluationOptions(options, normalizedManifest.value.createdAt);
  const configurationFingerprint = fingerprint(config);

  if (uniqueErrors.length) {
    return {
      ok: false,
      version: TRANSPARENT_1X2_EVALUATION_PACKAGE_VERSION,
      reason: uniqueErrors[0],
      errors: uniqueErrors,
      dataset: {
        datasetId: normalizedManifest.value.datasetId || null,
        datasetKind: normalizedManifest.value.datasetKind || null,
        rowCount: rows.length,
        sourceCount: normalizedManifest.value.sourceIds.length,
        sourceFingerprint,
        cohortFingerprint,
        predictionFingerprint,
        datasetFingerprint,
        realHistoricalEvidence: false
      },
      configurationFingerprint,
      automaticPromotionAllowed: false,
      canCountAsHistoricalValidation: false,
      paperOnly: true
    };
  }

  const evaluation = evaluateTransparent1X2Backtest(rows, config);
  const realHistoricalEvidence = normalizedManifest.value.datasetKind === "historical-observations"
    && normalizedManifest.value.rightsStatus === "reviewed";
  const allRowsEligible = evaluation.eligibleRows === rows.length && evaluation.excludedRows === 0;
  const canCountAsHistoricalValidation = realHistoricalEvidence
    && allRowsEligible
    && evaluation.sampleAssessment.sufficient;
  const resultFingerprint = fingerprint({
    version: evaluation.version,
    receivedRows: evaluation.receivedRows,
    eligibleRows: evaluation.eligibleRows,
    excludedRows: evaluation.excludedRows,
    model: evaluation.model,
    marketBenchmark: evaluation.marketBenchmark,
    deltaVsMarket: evaluation.deltaVsMarket,
    classBalance: evaluation.classBalance,
    slices: evaluation.slices,
    chronologicalFolds: evaluation.chronologicalFolds,
    sampleAssessment: evaluation.sampleAssessment,
    leakageBoundary: evaluation.leakageBoundary
  });
  const packageId = fingerprint({
    version: TRANSPARENT_1X2_EVALUATION_PACKAGE_VERSION,
    datasetFingerprint,
    cohortFingerprint,
    predictionFingerprint,
    configurationFingerprint,
    resultFingerprint
  });

  return {
    ok: true,
    version: TRANSPARENT_1X2_EVALUATION_PACKAGE_VERSION,
    packageId,
    generatedAt: normalizedManifest.value.createdAt,
    dataset: {
      datasetId: normalizedManifest.value.datasetId,
      datasetKind: normalizedManifest.value.datasetKind,
      createdAt: normalizedManifest.value.createdAt,
      dataCutoff: normalizedManifest.value.dataCutoff,
      rightsStatus: normalizedManifest.value.rightsStatus,
      marketBenchmarkType: normalizedManifest.value.marketBenchmarkType,
      rowCount: rows.length,
      sourceCount: normalizedManifest.value.sourceIds.length,
      sourceFingerprint,
      cohortFingerprint,
      predictionFingerprint,
      datasetFingerprint,
      realHistoricalEvidence
    },
    configuration: config,
    configurationFingerprint,
    resultFingerprint,
    evaluation,
    evidenceAssessment: {
      allRowsChronologyEligible: allRowsEligible,
      sampleSufficient: evaluation.sampleAssessment.sufficient,
      realHistoricalEvidence,
      canCountAsHistoricalValidation,
      label: canCountAsHistoricalValidation
        ? "historical-offline-evidence-ready-for-manual-review"
        : realHistoricalEvidence
          ? "historical-evidence-insufficient-do-not-promote"
          : "synthetic-ci-only-do-not-promote"
    },
    provenance: {
      sourceIdsIncluded: false,
      sourceFingerprint,
      cohortFingerprintExcludesModelPredictions: true,
      predictionFingerprintIsModelSpecific: true,
      restrictedRawPayloadIncluded: false,
      personalDataIncluded: false,
      closingLineFieldsAccepted: false,
      predictionTimeMarketSnapshotRequired: true,
      outcomeLabelMustBePostKickoff: true
    },
    automaticPromotionAllowed: false,
    productionProbabilityChanged: false,
    paperOnly: true
  };
}
