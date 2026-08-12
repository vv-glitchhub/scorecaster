import test from "node:test";
import assert from "node:assert/strict";
import { buildBasketballEfficiencyShadowV1 } from "../lib/basketball-efficiency-shadow-v1.mjs";
import { buildModelFactoryV1 } from "../lib/model-factory-v1.mjs";

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

test("Model Factory accepts audited basketball efficiency output into a non-market dependence group", () => {
  const base = pick();
  const model = buildBasketballEfficiencyShadowV1(base, observations(), { now: NOW });
  assert.equal(model.status, "ready");
  const factory = buildModelFactoryV1({ ...base, independentModelOutputs: [model.independentModelOutput] }, { now: NOW });
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
