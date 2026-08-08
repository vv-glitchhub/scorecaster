import test from "node:test";
import assert from "node:assert/strict";

import { buildTransparent1X2EvaluationPackage } from "../lib/transparent-1x2-evaluation-package.mjs";
import {
  compareTransparent1X2EvaluationPackages,
  TRANSPARENT_1X2_PAIRED_EVIDENCE_VERSION
} from "../lib/transparent-1x2-paired-evidence.mjs";

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    datasetId: "paired-epl-2025-26-v1",
    datasetKind: "historical-observations",
    createdAt: "2026-06-01T12:00:00.000Z",
    dataCutoff: "2026-06-01T11:00:00.000Z",
    rightsStatus: "reviewed",
    marketBenchmarkType: "no-vig-prediction-time",
    sourceIds: ["reviewed-evaluation-cohort"],
    containsPersonalData: false,
    containsRestrictedRawPayload: false,
    ...overrides
  };
}

function sharedRows(count = 12) {
  const outcomes = ["home", "draw", "away"];
  return Array.from({ length: count }, (_, index) => {
    const kickoff = new Date(Date.UTC(2026, 4, 1 + index, 18, 0, 0));
    const predicted = new Date(kickoff.getTime() - 24 * 60 * 60 * 1000);
    return {
      id: `paired-${index}`,
      predictedAt: predicted.toISOString(),
      kickoffAt: kickoff.toISOString(),
      trainingCutoff: new Date(predicted.getTime() - 60 * 60 * 1000).toISOString(),
      marketObservedAt: new Date(predicted.getTime() - 5 * 60 * 1000).toISOString(),
      outcomeObservedAt: new Date(kickoff.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      marketProbabilities: { home: 0.44, draw: 0.29, away: 0.27 },
      outcome: outcomes[index % outcomes.length],
      league: "EPL",
      season: "2025-26",
      market: "h2h",
      provider: "benchmark-a"
    };
  });
}

function modelRows(kind, count = 12) {
  return sharedRows(count).map((row, index) => {
    const actual = row.outcome;
    const probabilities = kind === "challenger"
      ? {
          home: actual === "home" ? 0.55 : 0.225,
          draw: actual === "draw" ? 0.55 : 0.225,
          away: actual === "away" ? 0.55 : 0.225
        }
      : { home: 0.36, draw: 0.33, away: 0.31 };
    return {
      ...row,
      trainingCutoff: kind === "challenger"
        ? new Date(Date.parse(row.predictedAt) - 2 * 60 * 60 * 1000).toISOString()
        : row.trainingCutoff,
      probabilities,
      decisionClass: kind === "challenger" ? "WATCH" : "PLAY",
      modelVersion: kind === "challenger" ? "dixon-coles-v2" : "baseline-v1"
    };
  });
}

const options = { minimumSample: 10, minimumTrain: 6, testWindow: 3, binCount: 10 };

function packageFor(kind, manifestOverride = {}, optionsOverride = {}) {
  return buildTransparent1X2EvaluationPackage({
    manifest: manifest(manifestOverride),
    records: modelRows(kind),
    options: { ...options, ...optionsOverride }
  });
}

test("cohort fingerprint is shared while prediction and full dataset fingerprints stay model-specific", () => {
  const baseline = packageFor("baseline");
  const challenger = packageFor("challenger");

  assert.equal(baseline.ok, true);
  assert.equal(challenger.ok, true);
  assert.equal(baseline.dataset.cohortFingerprint, challenger.dataset.cohortFingerprint);
  assert.notEqual(baseline.dataset.predictionFingerprint, challenger.dataset.predictionFingerprint);
  assert.notEqual(baseline.dataset.datasetFingerprint, challenger.dataset.datasetFingerprint);
  assert.equal(baseline.configurationFingerprint, challenger.configurationFingerprint);
  assert.equal(baseline.dataset.sourceFingerprint, challenger.dataset.sourceFingerprint);
  assert.equal(baseline.provenance.cohortFingerprintExcludesModelPredictions, true);
  assert.equal(baseline.provenance.predictionFingerprintIsModelSpecific, true);
});

test("paired historical comparator reports directional metric deltas without auto promotion or significance claims", () => {
  const comparison = compareTransparent1X2EvaluationPackages({
    baseline: packageFor("baseline"),
    challenger: packageFor("challenger")
  });

  assert.equal(comparison.ok, true);
  assert.equal(comparison.version, TRANSPARENT_1X2_PAIRED_EVIDENCE_VERSION);
  assert.equal(comparison.predictionsDiffer, true);
  assert.equal(comparison.metrics.direction.brier, "challenger-better");
  assert.equal(comparison.metrics.direction.logLoss, "challenger-better");
  assert.equal(comparison.metrics.direction.overall, "challenger-directionally-better");
  assert.ok(comparison.metrics.deltaChallengerMinusBaseline.brier < 0);
  assert.ok(comparison.metrics.deltaChallengerMinusBaseline.logLoss < 0);
  assert.equal(comparison.evidenceAssessment.realHistoricalPair, true);
  assert.equal(comparison.evidenceAssessment.readyForManualReview, true);
  assert.equal(comparison.evidenceAssessment.label, "paired-historical-evidence-ready-for-manual-review");
  assert.equal(comparison.evidenceAssessment.statisticalSignificanceClaimed, false);
  assert.equal(comparison.automaticPromotionAllowed, false);
  assert.equal(comparison.productionProbabilityChanged, false);
  assert.equal(comparison.comparisonId.length, 64);
  assert.ok(comparison.chronologicalFoldDeltas.length > 0);
});

test("identical predictions are a valid paired tie rather than an error", () => {
  const baseline = packageFor("baseline");
  const comparison = compareTransparent1X2EvaluationPackages({ baseline, challenger: baseline });

  assert.equal(comparison.ok, true);
  assert.equal(comparison.predictionsDiffer, false);
  assert.equal(comparison.metrics.deltaChallengerMinusBaseline.brier, 0);
  assert.equal(comparison.metrics.deltaChallengerMinusBaseline.logLoss, 0);
  assert.equal(comparison.metrics.direction.overall, "directional-tie");
  assert.deepEqual(comparison.failures, []);
});

test("different market cohort fails closed even if model metrics could be compared numerically", () => {
  const baseline = packageFor("baseline");
  const challengerRows = modelRows("challenger");
  challengerRows[0].marketProbabilities = { home: 0.42, draw: 0.3, away: 0.28 };
  const challenger = buildTransparent1X2EvaluationPackage({ manifest: manifest(), records: challengerRows, options });
  const comparison = compareTransparent1X2EvaluationPackages({ baseline, challenger });

  assert.equal(comparison.ok, false);
  assert.ok(comparison.failures.includes("cohort-mismatch"));
  assert.equal(comparison.evidenceAssessment.readyForManualReview, false);
  assert.equal(comparison.metrics.direction.overall, "not-comparable");
});

test("different evaluation configuration fails closed", () => {
  const comparison = compareTransparent1X2EvaluationPackages({
    baseline: packageFor("baseline"),
    challenger: packageFor("challenger", {}, { testWindow: 2 })
  });

  assert.equal(comparison.ok, false);
  assert.ok(comparison.failures.includes("configuration-mismatch"));
  assert.ok(comparison.failures.includes("chronological-fold-mismatch"));
});

test("synthetic pair can exercise the comparator but never becomes historical promotion evidence", () => {
  const synthetic = {
    datasetId: "paired-synthetic-v1",
    datasetKind: "synthetic-fixture",
    rightsStatus: "synthetic",
    sourceIds: ["synthetic-paired-generator"]
  };
  const comparison = compareTransparent1X2EvaluationPackages({
    baseline: packageFor("baseline", synthetic),
    challenger: packageFor("challenger", synthetic)
  });

  assert.equal(comparison.ok, true);
  assert.equal(comparison.evidenceAssessment.realHistoricalPair, false);
  assert.equal(comparison.evidenceAssessment.readyForManualReview, false);
  assert.equal(comparison.evidenceAssessment.label, "paired-synthetic-or-insufficient-evidence-do-not-promote");
  assert.equal(comparison.automaticPromotionAllowed, false);
});

test("insufficient historical sample remains comparable but cannot be ready for model review", () => {
  const highMinimum = { minimumSample: 100 };
  const comparison = compareTransparent1X2EvaluationPackages({
    baseline: packageFor("baseline", {}, highMinimum),
    challenger: packageFor("challenger", {}, highMinimum)
  });

  assert.equal(comparison.ok, true);
  assert.equal(comparison.evidenceAssessment.realHistoricalPair, false);
  assert.equal(comparison.evidenceAssessment.readyForManualReview, false);
  assert.equal(comparison.evidenceAssessment.label, "paired-synthetic-or-insufficient-evidence-do-not-promote");
});

test("paired report is redacted and does not embed evaluation rows or source identifiers", () => {
  const comparison = compareTransparent1X2EvaluationPackages({
    baseline: packageFor("baseline"),
    challenger: packageFor("challenger")
  });
  const serialized = JSON.stringify(comparison);

  assert.equal(comparison.provenance.rawEvaluationRowsIncluded, false);
  assert.doesNotMatch(serialized, /reviewed-evaluation-cohort/);
  assert.doesNotMatch(serialized, /"probabilities"\s*:/);
  assert.doesNotMatch(serialized, /service[_-]?role|bearer\s+[a-z0-9._-]{20,}/i);
});
