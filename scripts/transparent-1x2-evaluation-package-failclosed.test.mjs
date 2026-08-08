import test from "node:test";
import assert from "node:assert/strict";

import { buildTransparent1X2EvaluationPackage } from "../lib/transparent-1x2-evaluation-package.mjs";

const manifest = {
  schemaVersion: 1,
  datasetId: "strict-fixture",
  datasetKind: "synthetic-fixture",
  createdAt: "2026-06-02T00:00:00.000Z",
  dataCutoff: "2026-06-01T23:00:00.000Z",
  rightsStatus: "synthetic",
  marketBenchmarkType: "no-vig-prediction-time",
  sourceIds: ["synthetic-ci-generator"],
  containsPersonalData: false,
  containsRestrictedRawPayload: false
};

function row(overrides = {}) {
  return {
    id: "evt-1",
    predictedAt: "2026-06-01T12:00:00.000Z",
    kickoffAt: "2026-06-01T18:00:00.000Z",
    trainingCutoff: "2026-06-01T11:00:00.000Z",
    marketObservedAt: "2026-06-01T11:55:00.000Z",
    outcomeObservedAt: "2026-06-01T21:00:00.000Z",
    probabilities: { home: 0.45, draw: 0.3, away: 0.25 },
    marketProbabilities: { home: 0.44, draw: 0.3, away: 0.26 },
    outcome: "home",
    league: "Synthetic",
    season: "test",
    market: "h2h",
    provider: "synthetic",
    decisionClass: "WATCH",
    modelVersion: "test-v1",
    ...overrides
  };
}

test("malformed probability triples fail before the evaluator can silently exclude them", () => {
  for (const probabilities of [
    { home: 0.8, draw: 0.8, away: 0.2 },
    { home: 0, draw: 0.5, away: 0.5 },
    { home: -0.1, draw: 0.5, away: 0.6 },
    { home: Number.NaN, draw: 0.5, away: 0.5 }
  ]) {
    const result = buildTransparent1X2EvaluationPackage({ manifest, records: [row({ probabilities })] });
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes("invalid-model-probabilities"));
  }
});

test("market benchmark probabilities are held to the same strict normalization boundary", () => {
  const result = buildTransparent1X2EvaluationPackage({
    manifest,
    records: [row({ marketProbabilities: { home: 0.7, draw: 0.7, away: 0.2 } })]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("invalid-market-probabilities"));
});

test("prediction and training chronology cannot be omitted to make a row eligible", () => {
  for (const overrides of [
    { predictedAt: null },
    { trainingCutoff: null },
    { kickoffAt: null },
    { marketObservedAt: null },
    { outcomeObservedAt: null }
  ]) {
    const result = buildTransparent1X2EvaluationPackage({ manifest, records: [row(overrides)] });
    assert.equal(result.ok, false);
  }
});

test("empty datasets cannot create a fingerprint-only evidence package", () => {
  const result = buildTransparent1X2EvaluationPackage({ manifest, records: [] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("empty-evaluation-dataset"));
  assert.equal(result.canCountAsHistoricalValidation, false);
});
