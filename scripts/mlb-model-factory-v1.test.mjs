import test from "node:test";
import assert from "node:assert/strict";
import { buildMlbPitchingOffenseShadowV1 } from "../lib/mlb-pitching-offense-shadow-v1.mjs";
import { buildModelFactoryV1 } from "../lib/model-factory-v1.mjs";
import { buildAdvancedSignalReadinessV1 } from "../lib/advanced-signal-readiness-v1.mjs";

const NOW = Date.parse("2026-08-12T10:00:00.000Z");

function pick() {
  return {
    gameId: "mlb-factory-1",
    sportKey: "baseball_mlb",
    league: "MLB",
    homeTeam: "Boston Red Sox",
    awayTeam: "New York Yankees",
    selection: "Boston Red Sox",
    commenceTime: "2026-08-12T18:00:00.000Z",
    market: "h2h"
  };
}

function teamObs(side, metric, value) {
  return {
    participantId: side === "home" ? "Boston Red Sox" : "New York Yankees",
    metric,
    value,
    unit: "z-score",
    observedAt: "2026-08-12T09:00:00.000Z",
    capturedAt: "2026-08-12T09:05:00.000Z",
    provider: "licensed-baseball-analytics",
    sourceTrust: 0.9,
    confidence: 0.9,
    metadata: { side, scale: "z-score" }
  };
}

function starter(side, value) {
  return {
    participantId: side === "home" ? "Home Starter" : "Away Starter",
    metric: "starting-pitcher-xwoba-allowed",
    value,
    observedAt: "2026-08-12T09:00:00.000Z",
    capturedAt: "2026-08-12T09:05:00.000Z",
    provider: "licensed-baseball-analytics",
    sourceTrust: 0.9,
    confidence: 0.9,
    metadata: { side, starter: true, role: "starting-pitcher" }
  };
}

function observations() {
  return [
    teamObs("home", "lineup-strength", 0.6),
    teamObs("home", "bullpen-depth", 0.3),
    starter("home", 0.31),
    teamObs("away", "lineup-strength", 0.1),
    teamObs("away", "bullpen-depth", -0.2),
    starter("away", 0.35)
  ];
}

function state() {
  const base = pick();
  const model = buildMlbPitchingOffenseShadowV1(base, observations(), { now: NOW });
  const factory = buildModelFactoryV1({ ...base, independentModelOutputs: [model.independentModelOutput] }, { now: NOW });
  return { base, model, factory };
}

test("Model Factory admits MLB challenger into lineage-derived expected-performance group", () => {
  const { model, factory } = state();
  assert.equal(model.status, "ready");
  assert.equal(factory.counts.acceptedOutputs, 1);
  assert.equal(factory.counts.rejectedOutputs, 0);
  const output = factory.outputs[0];
  assert.equal(output.modelId, "mlb-pitching-offense-v1");
  assert.equal(output.modelVersion, "mlb-pitching-offense-shadow-v1");
  assert.equal(output.dependenceGroup, "baseball_mlb-expected-performance-family");
  assert.deepEqual(output.audit.signalFamilies, ["expected-performance", "performance-statistics"]);
  assert.equal(output.audit.dependenceGroupDerivedFromLineage, true);
  assert.equal(output.performance, null);
  assert.equal(factory.contracts.marketDerivedIndependentModelAllowed, false);
  assert.equal(factory.contracts.automaticPromotionAllowed, false);
  assert.equal(factory.contracts.productionProbabilityChanged, false);
});

test("MLB expected-performance readiness requires holdout and never becomes production eligible from model presence alone", () => {
  const { base, factory } = state();
  const readiness = buildAdvancedSignalReadinessV1({ ...base, modelFactoryV1: factory }, {
    now: NOW,
    providerConfiguration: { configured: true, source: "licensed-baseball-analytics", transport: "https-post" }
  });
  const family = readiness.families.find((row) => row.family === "expected-performance");
  assert.ok(family);
  assert.equal(family.status, "shadow-model-needs-holdout");
  assert.equal(family.probabilityModelPresent, true);
  assert.equal(family.performanceEvidenceReady, false);
  assert.equal(family.productionEligible, false);
  assert.equal(readiness.contracts.modelOutputWithoutHoldoutGetsPerformanceWeight, false);
  assert.equal(readiness.contracts.productionProbabilityChanged, false);
});
