import test from "node:test";
import assert from "node:assert/strict";
import { buildBasketballEfficiencyShadowV1 } from "../lib/basketball-efficiency-shadow-v1.mjs";
import { buildModelFactoryV1 } from "../lib/model-factory-v1.mjs";
import { buildAdvancedSignalReadinessV1 } from "../lib/advanced-signal-readiness-v1.mjs";

const NOW = Date.parse("2026-08-12T10:00:00.000Z");

function pick() {
  return {
    gameId: "nba-factory-1",
    sportKey: "basketball_nba",
    league: "NBA",
    homeTeam: "Boston Celtics",
    awayTeam: "New York Knicks",
    selection: "Boston Celtics",
    commenceTime: "2026-08-12T18:00:00.000Z",
    market: "h2h"
  };
}

function obs(side, metric, value) {
  return {
    participantId: side === "home" ? "Boston Celtics" : "New York Knicks",
    metric,
    value,
    observedAt: "2026-08-12T09:00:00.000Z",
    capturedAt: "2026-08-12T09:05:00.000Z",
    provider: "licensed-basketball-analytics",
    sourceTrust: 0.9,
    confidence: 0.9,
    metadata: { side }
  };
}

function observations() {
  return [
    obs("home", "pace", 100),
    obs("home", "offensive-rating", 118),
    obs("home", "defensive-rating", 108),
    obs("away", "pace", 98),
    obs("away", "offensive-rating", 111),
    obs("away", "defensive-rating", 114)
  ];
}

function factoryState() {
  const base = pick();
  const model = buildBasketballEfficiencyShadowV1(base, observations(), { now: NOW });
  const factory = buildModelFactoryV1({ ...base, independentModelOutputs: [model.independentModelOutput] }, { now: NOW });
  return { base, model, factory };
}

test("Model Factory accepts audited basketball efficiency output into a non-market dependence group", () => {
  const { model, factory } = factoryState();
  assert.equal(model.status, "ready");
  assert.equal(factory.counts.acceptedOutputs, 1);
  assert.equal(factory.counts.rejectedOutputs, 0);
  assert.equal(factory.counts.uniqueDependenceGroups, 1);
  const output = factory.outputs[0];
  assert.equal(output.modelId, "nba-efficiency-pace-v1");
  assert.equal(output.modelVersion, "nba-efficiency-pace-shadow-v1");
  assert.equal(output.dependenceGroup, "basketball_nba-performance-statistics-family");
  assert.deepEqual(output.audit.signalFamilies, ["context", "performance-statistics"]);
  assert.equal(output.audit.dependenceGroupDerivedFromLineage, true);
  assert.equal(output.performance, null);
  assert.equal(factory.contracts.marketDerivedIndependentModelAllowed, false);
  assert.equal(factory.contracts.automaticPromotionAllowed, false);
  assert.equal(factory.contracts.productionProbabilityChanged, false);
});

test("basketball performance-statistics readiness becomes shadow-model-needs-holdout, not production-ready", () => {
  const { base, factory } = factoryState();
  const readiness = buildAdvancedSignalReadinessV1({ ...base, modelFactoryV1: factory }, {
    now: NOW,
    providerConfiguration: {
      configured: true,
      source: "licensed-basketball-analytics",
      transport: "https-post"
    }
  });
  const family = readiness.families.find((row) => row.family === "performance-statistics");
  assert.ok(family);
  assert.equal(family.status, "shadow-model-needs-holdout");
  assert.equal(family.probabilityModelPresent, true);
  assert.equal(family.metricCoverage.rate, 1);
  assert.deepEqual(family.metricCoverage.missingMetrics, []);
  assert.equal(family.performanceEvidenceReady, false);
  assert.equal(family.productionEligible, false);
  assert.equal(readiness.contracts.modelOutputWithoutHoldoutGetsPerformanceWeight, false);
  assert.equal(readiness.contracts.productionProbabilityChanged, false);
});
