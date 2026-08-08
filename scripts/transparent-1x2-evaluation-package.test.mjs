import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTransparent1X2EvaluationPackage,
  TRANSPARENT_1X2_EVALUATION_PACKAGE_VERSION
} from "../lib/transparent-1x2-evaluation-package.mjs";

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    datasetId: "epl-2025-26-eval-v1",
    datasetKind: "historical-observations",
    createdAt: "2026-06-01T12:00:00.000Z",
    dataCutoff: "2026-06-01T11:00:00.000Z",
    rightsStatus: "reviewed",
    marketBenchmarkType: "no-vig-prediction-time",
    sourceIds: ["internal-prediction-log", "reviewed-market-snapshot"],
    containsPersonalData: false,
    containsRestrictedRawPayload: false,
    ...overrides
  };
}

function rows(count = 12) {
  const outcomes = ["home", "draw", "away"];
  return Array.from({ length: count }, (_, index) => {
    const kickoff = new Date(Date.UTC(2026, 4, 1 + index, 18, 0, 0));
    const predicted = new Date(kickoff.getTime() - 24 * 60 * 60 * 1000);
    const marketObserved = new Date(predicted.getTime() - 5 * 60 * 1000);
    const trainingCutoff = new Date(predicted.getTime() - 60 * 60 * 1000);
    const outcomeObserved = new Date(kickoff.getTime() + 3 * 60 * 60 * 1000);
    const home = 0.46 + ((index % 3) - 1) * 0.01;
    const draw = 0.28;
    return {
      id: `evt-${index}`,
      predictedAt: predicted.toISOString(),
      kickoffAt: kickoff.toISOString(),
      trainingCutoff: trainingCutoff.toISOString(),
      marketObservedAt: marketObserved.toISOString(),
      outcomeObservedAt: outcomeObserved.toISOString(),
      probabilities: { home, draw, away: 1 - home - draw },
      marketProbabilities: { home: 0.44, draw: 0.29, away: 0.27 },
      outcome: outcomes[index % outcomes.length],
      league: "EPL",
      season: "2025-26",
      market: "h2h",
      provider: "benchmark-a",
      decisionClass: index % 2 ? "WATCH" : "PLAY",
      modelVersion: "baseline-v1"
    };
  });
}

const options = { minimumSample: 10, minimumTrain: 6, testWindow: 3, binCount: 10 };

test("historical package is deterministic, redacted and ready only for manual review", () => {
  const input = { manifest: manifest(), records: rows(), options };
  const one = buildTransparent1X2EvaluationPackage(input);
  const two = buildTransparent1X2EvaluationPackage(input);

  assert.equal(one.ok, true);
  assert.equal(one.version, TRANSPARENT_1X2_EVALUATION_PACKAGE_VERSION);
  assert.equal(one.packageId, two.packageId);
  assert.equal(one.dataset.datasetFingerprint, two.dataset.datasetFingerprint);
  assert.equal(one.configurationFingerprint, two.configurationFingerprint);
  assert.equal(one.resultFingerprint, two.resultFingerprint);
  assert.equal(one.dataset.rowCount, 12);
  assert.equal(one.dataset.realHistoricalEvidence, true);
  assert.equal(one.evidenceAssessment.allRowsChronologyEligible, true);
  assert.equal(one.evidenceAssessment.sampleSufficient, true);
  assert.equal(one.evidenceAssessment.canCountAsHistoricalValidation, true);
  assert.equal(one.evidenceAssessment.label, "historical-offline-evidence-ready-for-manual-review");
  assert.equal(one.automaticPromotionAllowed, false);
  assert.equal(one.productionProbabilityChanged, false);
  assert.equal(one.provenance.sourceIdsIncluded, false);
  assert.equal(one.provenance.closingLineFieldsAccepted, false);

  const serialized = JSON.stringify(one);
  assert.doesNotMatch(serialized, /internal-prediction-log|reviewed-market-snapshot/);
  assert.doesNotMatch(serialized, /"closingOdds"\s*:|"closingLine"\s*:|service[_-]?role|bearer\s+[a-z0-9._-]{20,}/i);
});

test("synthetic fixture can exercise CI but cannot count as historical validation", () => {
  const result = buildTransparent1X2EvaluationPackage({
    manifest: manifest({
      datasetId: "synthetic-ci-v1",
      datasetKind: "synthetic-fixture",
      rightsStatus: "synthetic",
      sourceIds: ["synthetic-ci-generator"]
    }),
    records: rows(),
    options
  });

  assert.equal(result.ok, true);
  assert.equal(result.dataset.realHistoricalEvidence, false);
  assert.equal(result.evidenceAssessment.canCountAsHistoricalValidation, false);
  assert.equal(result.evidenceAssessment.label, "synthetic-ci-only-do-not-promote");
  assert.equal(result.automaticPromotionAllowed, false);
});

test("future market snapshot relative to prediction fails closed", () => {
  const records = rows();
  records[0].marketObservedAt = new Date(Date.parse(records[0].predictedAt) + 1000).toISOString();
  const result = buildTransparent1X2EvaluationPackage({ manifest: manifest(), records, options });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("market-observed-after-prediction"));
  assert.equal(result.canCountAsHistoricalValidation, false);
});

test("outcome label at or before kickoff fails closed", () => {
  const records = rows();
  records[0].outcomeObservedAt = records[0].kickoffAt;
  const result = buildTransparent1X2EvaluationPackage({ manifest: manifest(), records, options });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("outcome-observed-not-after-kickoff"));
});

test("closing-line and other unexpected fields are rejected rather than ignored", () => {
  for (const key of ["closingOdds", "closingLine", "settlementPrice", "postKickoffFeatures"]) {
    const records = rows();
    records[0][key] = 2.1;
    const result = buildTransparent1X2EvaluationPackage({ manifest: manifest(), records, options });
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes(`unexpected-row-field:${key}`));
  }
});

test("duplicate row identities fail closed", () => {
  const records = rows();
  records[1].id = records[0].id;
  const result = buildTransparent1X2EvaluationPackage({ manifest: manifest(), records, options });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("duplicate-row-id"));
});

test("data cutoff must cover every observed outcome", () => {
  const result = buildTransparent1X2EvaluationPackage({
    manifest: manifest({ dataCutoff: "2026-05-01T18:30:00.000Z" }),
    records: rows(),
    options
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("row-outcome-after-data-cutoff"));
});

test("historical data requires reviewed rights and explicit privacy/raw-payload boundaries", () => {
  for (const override of [
    { rightsStatus: "synthetic" },
    { containsPersonalData: true },
    { containsRestrictedRawPayload: true },
    { sourceIds: [] }
  ]) {
    const result = buildTransparent1X2EvaluationPackage({ manifest: manifest(override), records: rows(), options });
    assert.equal(result.ok, false);
    assert.equal(result.canCountAsHistoricalValidation, false);
  }
});
