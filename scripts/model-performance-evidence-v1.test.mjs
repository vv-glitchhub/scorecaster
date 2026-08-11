import test from "node:test";
import assert from "node:assert/strict";
import { buildModelPerformanceEvidenceV1 } from "../lib/model-performance-evidence-v1.mjs";

const NOW = Date.parse("2026-08-11T09:00:00.000Z");
const HORIZON = "2026-08-11T18:00:00.000Z";

function validEvidence(overrides = {}) {
  return {
    modelId: "nhl-form-rest-logit-v1",
    modelVersion: "nhl-form-rest-logit-v1",
    dependenceGroup: "icehockey_nhl-form-rest-logit-family",
    scope: { sport: "icehockey", league: "nhl", market: "h2h" },
    status: "validated",
    evaluationMode: "chronological-holdout",
    sampleSize: 420,
    performanceWeight: 0.82,
    weightSource: "chronological-holdout",
    evaluatedAt: "2026-08-11T08:00:00.000Z",
    trainingCutoff: "2026-07-01T00:00:00.000Z",
    testStart: "2026-07-02T00:00:00.000Z",
    testEnd: "2026-08-10T23:00:00.000Z",
    brier: 0.214,
    logLoss: 0.603,
    calibrationGap: 0.032,
    baselineBrierDelta: -0.009,
    baselineLogLossDelta: -0.018,
    preEventOnly: true,
    closingLineLeakage: false,
    postEventDataUsed: false,
    ...overrides
  };
}

test("validated chronological holdout evidence becomes ensemble calibration-ready", () => {
  const result = buildModelPerformanceEvidenceV1(validEvidence(), { predictionHorizon: HORIZON, now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.calibrationReady, true);
  assert.equal(result.value.sampleSize, 420);
  assert.equal(result.value.chronologySafe, true);
  assert.equal(result.ensemblePerformance.performanceWeight, 0.82);
  assert.equal(result.automaticPromotionAllowed, false);
  assert.equal(result.paperOnly, true);
});

test("small holdout samples remain visible but cannot create a performance weight", () => {
  const result = buildModelPerformanceEvidenceV1(validEvidence({ sampleSize: 60, status: "research" }), { predictionHorizon: HORIZON, now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.calibrationReady, false);
  assert.equal(result.value.sampleSize, 60);
  assert.equal(result.ensemblePerformance.performanceWeight, null);
  assert.equal(result.ensemblePerformance.weightSource, null);
});

test("performance evidence fails closed on leakage", () => {
  const result = buildModelPerformanceEvidenceV1(validEvidence({ closingLineLeakage: true }), { predictionHorizon: HORIZON, now: NOW });
  assert.equal(result.ok, false);
  assert.equal(result.calibrationReady, false);
  assert.equal(result.value.chronologySafe, false);
  assert.ok(result.errors.includes("leakage-boundary-violated"));
});

test("training cutoff after the prediction horizon is rejected", () => {
  const result = buildModelPerformanceEvidenceV1(validEvidence({ trainingCutoff: "2026-08-12T00:00:00.000Z" }), { predictionHorizon: HORIZON, now: NOW });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("training-cutoff-after-prediction-horizon"));
  assert.equal(result.ensemblePerformance.performanceWeight, null);
});

test("unknown performance weight sources cannot influence the ensemble", () => {
  const result = buildModelPerformanceEvidenceV1(validEvidence({ weightSource: "manual-opinion" }), { predictionHorizon: HORIZON, now: NOW });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("unsupported-weight-source"));
  assert.equal(result.calibrationReady, false);
});
