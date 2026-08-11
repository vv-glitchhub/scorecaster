import test from "node:test";
import assert from "node:assert/strict";
import { buildModelFactoryV1, MODEL_FACTORY_VERSION } from "../lib/model-factory-v1.mjs";
import { attachDecisionArchitectureV1 } from "../lib/decision-architecture-v1.mjs";

const NOW = Date.parse("2026-08-11T09:00:00.000Z");

function basePick(overrides = {}) {
  return {
    gameId: "event-1",
    sportKey: "icehockey_nhl",
    league: "icehockey_nhl",
    leagueTitle: "NHL",
    market: "h2h",
    commenceTime: "2026-08-11T18:00:00.000Z",
    homeTeam: "Home",
    awayTeam: "Away",
    selection: "Home",
    marketProbability: 0.51,
    consensusProbability: 0.51,
    intelligenceFusionV2: {
      trust: { score: 0.8 },
      coverage: { coverageRate: 0.8 },
      dataQualityGate: { safeForAi: true }
    },
    ...overrides
  };
}

function readyFormRest(overrides = {}) {
  return {
    version: "form-rest-shadow-v1",
    modelId: "nhl-form-rest-logit-v1",
    mode: "binary-shadow",
    status: "ready",
    sportKey: "icehockey_nhl",
    generatedAt: "2026-08-11T08:55:00.000Z",
    shadowProbability: 0.57,
    chronologyGuard: true,
    provider: { source: "thesportsdb" },
    ...overrides
  };
}

function readyHistoricalRating(overrides = {}) {
  return {
    version: "historical-rating-shadow-v1",
    modelId: "nhl-recent-elo-v1",
    status: "ready",
    sportKey: "icehockey_nhl",
    generatedAt: "2026-08-11T08:55:00.000Z",
    shadowProbability: 0.6,
    chronologyGuard: true,
    trainingUsesOnlyCompletedEventsBeforeFixture: true,
    provider: { source: "thesportsdb" },
    ...overrides
  };
}

test("Model Factory V1 turns a ready NHL form/rest shadow into one audited model output", () => {
  const result = buildModelFactoryV1(basePick({ formRestShadow: readyFormRest() }), { now: NOW });
  assert.equal(result.version, MODEL_FACTORY_VERSION);
  assert.equal(result.counts.acceptedOutputs, 1);
  assert.equal(result.outputs[0].modelId, "nhl-form-rest-logit-v1");
  assert.equal(result.outputs[0].audit.independentPredictiveModel, true);
  assert.equal(result.outputs[0].audit.deterministic, true);
  assert.match(result.outputs[0].dependenceGroup, /historical-results-family/);
  assert.deepEqual(result.outputs[0].signalLineageV1.signalFamilies, ["historical-results"]);
  assert.equal(result.outputs[0].audit.dependenceGroupDerivedFromLineage, true);
  assert.equal(result.contracts.productionProbabilityChanged, false);
});

test("Model Factory V1 admits ready Historical Rating as a deterministic shadow model", () => {
  const result = buildModelFactoryV1(basePick({ historicalRatingShadow: readyHistoricalRating() }), { now: NOW });
  assert.equal(result.counts.acceptedOutputs, 1);
  assert.equal(result.outputs[0].modelId, "nhl-recent-elo-v1");
  assert.equal(result.outputs[0].role, "historical-rating-shadow");
  assert.match(result.outputs[0].dependenceGroup, /historical-results-family/);
  assert.equal(result.outputs[0].audit.implementationPath, "lib/historical-rating-shadow-model.mjs");
});

test("form/rest and rating models share one top-level historical dependence group", () => {
  const result = attachDecisionArchitectureV1(basePick({
    formRestShadow: readyFormRest(),
    historicalRatingShadow: readyHistoricalRating()
  }), { now: NOW });

  assert.equal(result.modelFactoryV1.counts.acceptedOutputs, 2);
  assert.equal(result.modelFactoryV1.counts.uniqueDependenceGroups, 1);
  assert.equal(result.ensembleEngineV1.counts.researchEligible, 2);
  assert.equal(result.ensembleEngineV1.counts.researchGroups, 1);
  assert.ok(result.ensembleEngineV1.researchRiskGate.reasons.includes("fewer-than-two-independent-model-groups"));
  assert.equal(result.modelFactoryV1.contracts.historicalResultModelsDoubleCountedAsIndependentFamilies, false);
});

test("feature-only form/rest profiles are inventoried but never cast a probability vote", () => {
  const result = buildModelFactoryV1(basePick({
    sportKey: "baseball_mlb",
    formRestShadow: readyFormRest({
      modelId: "mlb-form-rest-features-v1",
      sportKey: "baseball_mlb",
      mode: "feature-only",
      status: "feature_only",
      shadowProbability: null
    })
  }), { now: NOW });
  assert.equal(result.counts.acceptedOutputs, 0);
  assert.equal(result.counts.inventoriedNonVotingAdapters, 1);
  assert.equal(result.inventory[0].adapter, "form-rest-feature-only");
  assert.equal(result.contracts.featureOnlyModelsCastProbabilityVote, false);
});

test("unready Historical Rating remains in inventory but cannot vote", () => {
  const result = buildModelFactoryV1(basePick({
    historicalRatingShadow: readyHistoricalRating({ status: "insufficient_history", shadowProbability: null })
  }), { now: NOW });
  assert.equal(result.counts.acceptedOutputs, 0);
  assert.equal(result.inventory[0].adapter, "historical-rating-shadow");
  assert.equal(result.inventory[0].status, "insufficient_history");
});

test("unaudited external probabilities are rejected", () => {
  const result = buildModelFactoryV1(basePick({
    independentModelOutputs: [{
      modelId: "mystery-model",
      probability: 0.64,
      generatedAt: "2026-08-11T08:50:00.000Z"
    }]
  }), { now: NOW });
  assert.equal(result.counts.acceptedOutputs, 0);
  assert.equal(result.counts.rejectedOutputs, 1);
  assert.ok(result.rejectedModels[0].reasons.includes("missing-signal-lineage"));
  assert.ok(result.rejectedModels[0].reasons.includes("not-independent-predictive-model"));
  assert.ok(result.rejectedModels[0].reasons.includes("not-deterministic"));
});

test("legacy random model remains blocked even if it claims an audit", () => {
  const result = buildModelFactoryV1(basePick({
    independentModelOutputs: [{
      modelId: "model-engine-v3",
      modelVersion: "model-engine-v3",
      probability: 0.7,
      signalFamilies: ["historical-results"],
      generatedAt: "2026-08-11T08:50:00.000Z",
      audit: {
        independentPredictiveModel: true,
        deterministic: true,
        chronologySafe: true,
        implementationPath: "lib/model-engine-v3.js"
      }
    }]
  }), { now: NOW });
  assert.equal(result.counts.acceptedOutputs, 0);
  assert.ok(result.rejectedModels[0].reasons.includes("banned-random-or-legacy-model"));
});

test("audited expected-performance challenger gets a lineage-derived independent group", () => {
  const result = buildModelFactoryV1(basePick({
    independentModelOutputs: [{
      modelId: "nhl-xg-shadow-v1",
      modelVersion: "nhl-xg-shadow-v1",
      modelFamily: "nhl-xg",
      dependenceGroup: "totally-independent-claimed-by-model",
      probability: 0.62,
      generatedAt: "2026-08-11T08:50:00.000Z",
      signalFamilies: ["xg", "shot-quality"],
      dataLineage: {
        providers: ["advanced-hockey-provider"],
        metrics: ["xg", "shot-quality", "goals-saved-above-expected"]
      },
      audit: {
        independentPredictiveModel: true,
        deterministic: true,
        chronologySafe: true,
        source: "advanced-hockey-provider",
        implementationPath: "models/nhl-xg-shadow-v1"
      }
    }]
  }), { now: NOW });

  assert.equal(result.counts.acceptedOutputs, 1);
  assert.equal(result.outputs[0].dependenceGroup, "icehockey_nhl-expected-performance-family");
  assert.equal(result.outputs[0].signalLineageV1.claimedDependenceGroup, "totally-independent-claimed-by-model");
  assert.ok(result.warnings.some((warning) => warning.includes("claimed-dependence-group-overridden-by-lineage")));
  assert.equal(result.contracts.dependenceGroupSelfDeclared, false);
});

test("market-derived challenger is rejected even with deterministic audit flags", () => {
  const result = buildModelFactoryV1(basePick({
    independentModelOutputs: [{
      modelId: "odds-repackaged-model",
      probability: 0.61,
      generatedAt: "2026-08-11T08:50:00.000Z",
      signalFamilies: ["odds-consensus", "expected-performance"],
      audit: {
        independentPredictiveModel: true,
        deterministic: true,
        chronologySafe: true,
        source: "some-provider"
      }
    }]
  }), { now: NOW });

  assert.equal(result.counts.acceptedOutputs, 0);
  assert.ok(result.rejectedModels[0].reasons.includes("market-derived-signal-not-independent"));
  assert.equal(result.contracts.marketDerivedIndependentModelAllowed, false);
});

test("validated performance evidence is the only route to a factory calibration-ready output", () => {
  const result = buildModelFactoryV1(basePick({
    formRestShadow: readyFormRest(),
    modelPerformanceEvidenceV1: [{
      modelId: "nhl-form-rest-logit-v1",
      modelVersion: "nhl-form-rest-logit-v1",
      dependenceGroup: "icehockey_nhl-historical-results-family",
      scope: { sport: "icehockey", league: "nhl", market: "h2h" },
      status: "validated",
      evaluationMode: "chronological-holdout",
      sampleSize: 300,
      performanceWeight: 0.75,
      weightSource: "chronological-holdout",
      evaluatedAt: "2026-08-11T08:00:00.000Z",
      trainingCutoff: "2026-07-01T00:00:00.000Z",
      testStart: "2026-07-02T00:00:00.000Z",
      testEnd: "2026-08-10T22:00:00.000Z",
      brier: 0.21,
      logLoss: 0.59,
      calibrationGap: 0.03,
      preEventOnly: true,
      closingLineLeakage: false,
      postEventDataUsed: false
    }]
  }), { now: NOW });
  assert.equal(result.counts.acceptedOutputs, 1);
  assert.equal(result.counts.calibrationReadyOutputs, 1);
  assert.equal(result.outputs[0].performance.performanceWeight, 0.75);
  assert.equal(result.outputs[0].performanceEvidenceV1.calibrationReady, true);
});

test("Decision Architecture V1 canonicalizes model inputs through Model Factory before Ensemble", () => {
  const result = attachDecisionArchitectureV1(basePick({
    formRestShadow: readyFormRest(),
    historicalRatingShadow: readyHistoricalRating(),
    independentModelOutputs: [{
      modelId: "unaudited",
      probability: 0.9
    }]
  }), { now: NOW });
  assert.equal(result.modelFactoryV1.counts.acceptedOutputs, 2);
  assert.equal(result.modelFactoryV1.counts.rejectedOutputs, 1);
  assert.equal(result.decisionArchitectureV1.modelFactoryBypassed, false);
  assert.equal(result.ensembleEngineV1.models.some((row) => row.modelId === "unaudited"), false);
  assert.equal(result.productionProbabilityAdjustedByFeatureEnsemble, false);
});
