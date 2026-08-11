import test from "node:test";
import assert from "node:assert/strict";
import { buildEnsembleSnapshotV1, ENSEMBLE_ENGINE_VERSION } from "../lib/ensemble-engine-v1.mjs";

const NOW = Date.parse("2026-08-11T07:00:00.000Z");

function basePick() {
  return {
    gameId: "event-1",
    sportKey: "soccer_epl",
    leagueTitle: "Premier League",
    market: "h2h",
    commenceTime: "2026-08-11T18:00:00.000Z",
    marketProbability: 0.52,
    intelligenceFusionV2: {
      trust: { score: 0.82 },
      coverage: { coverageRate: 0.8 },
      dataQualityGate: { safeForAi: true }
    }
  };
}

function calibratedModel(modelId, probability, weight, dependenceGroup = null) {
  return {
    modelId,
    modelVersion: `${modelId}-v1`,
    dependenceGroup,
    probability,
    generatedAt: "2026-08-11T06:50:00.000Z",
    audit: {
      independentPredictiveModel: true,
      deterministic: true,
      chronologySafe: true,
      source: "test-model",
      ...(dependenceGroup ? { dependenceGroup } : {})
    },
    performance: {
      status: "usable",
      sampleSize: 250,
      performanceWeight: weight,
      weightSource: "validated-calibration-slice",
      evaluatedAt: "2026-08-11T06:00:00.000Z",
      trainingCutoff: "2026-08-10T23:59:00.000Z",
      brier: 0.2,
      logLoss: 0.58,
      calibrationGap: 0.035
    }
  };
}

test("Ensemble Engine V1 combines only validated independent deterministic models", () => {
  const pick = basePick();
  pick.independentModelOutputs = [
    calibratedModel("elo-rating", 0.6, 0.7),
    calibratedModel("poisson-score", 0.56, 0.3)
  ];

  const result = buildEnsembleSnapshotV1(pick, { counts: { rejected: 0 } }, { now: NOW });

  assert.equal(result.version, ENSEMBLE_ENGINE_VERSION);
  assert.equal(result.counts.researchEligible, 2);
  assert.equal(result.counts.researchGroups, 2);
  assert.equal(result.counts.calibrationReady, 2);
  assert.equal(result.counts.calibrationReadyGroups, 2);
  assert.equal(result.calibratedShadowProbability, 0.588);
  assert.equal(result.marketBenchmark.probability, 0.52);
  assert.equal(result.marketBenchmark.independentPredictiveModel, false);
  assert.equal(result.contract.productionProbabilityChanged, false);
  assert.equal(result.researchRiskGate.decision, "REVIEW");
  assert.equal(result.promotion.automaticPromotionAllowed, false);
  assert.equal(result.promotion.eligibleForHumanReview, true);
});

test("Ensemble Engine V1 rejects the legacy random model even if it claims an audit", () => {
  const pick = basePick();
  pick.independentModelOutputs = [
    {
      ...calibratedModel("model-engine-v3", 0.8, 1),
      audit: {
        independentPredictiveModel: true,
        deterministic: true,
        chronologySafe: true,
        implementationPath: "lib/model-engine-v3.js"
      }
    },
    calibratedModel("elo-rating", 0.58, 1)
  ];

  const result = buildEnsembleSnapshotV1(pick, { counts: { rejected: 0 } }, { now: NOW });
  const legacy = result.models.find((row) => row.modelId === "model-engine-v3");

  assert.equal(legacy.eligibleForResearch, false);
  assert.ok(legacy.rejectionReasons.includes("banned-random-or-legacy-model"));
  assert.equal(result.counts.researchEligible, 1);
  assert.equal(result.researchRiskGate.decision, "NO_BET");
});

test("Ensemble Engine V1 turns large model disagreement into a research NO_BET gate", () => {
  const pick = basePick();
  pick.independentModelOutputs = [
    calibratedModel("rating-model", 0.72, 0.5),
    calibratedModel("score-model", 0.38, 0.5)
  ];

  const result = buildEnsembleSnapshotV1(pick, { counts: { rejected: 0 } }, { now: NOW });

  assert.equal(result.uncertainty.band, "high");
  assert.equal(result.researchRiskGate.decision, "NO_BET");
  assert.ok(result.researchRiskGate.reasons.includes("high-model-disagreement"));
  assert.equal(result.researchRiskGate.productionDecisionChanged, false);
});

test("Ensemble Engine V1 never invents performance weights for unvalidated models", () => {
  const pick = basePick();
  pick.independentModelOutputs = [
    {
      modelId: "rating-model",
      probability: 0.59,
      audit: { independentPredictiveModel: true, deterministic: true, chronologySafe: true }
    },
    {
      modelId: "score-model",
      probability: 0.57,
      audit: { independentPredictiveModel: true, deterministic: true, chronologySafe: true }
    }
  ];

  const result = buildEnsembleSnapshotV1(pick, { counts: { rejected: 0 } }, { now: NOW });

  assert.equal(result.shadowProbability, 0.58);
  assert.equal(result.calibratedShadowProbability, null);
  assert.equal(result.counts.calibrationReady, 0);
  assert.equal(result.weighting.inventedPerformanceWeights, false);
  assert.equal(result.researchRiskGate.decision, "NO_BET");
});

test("Ensemble Engine V1 rejects context-only outputs that masquerade as models", () => {
  const pick = basePick();
  pick.independentModelOutputs = [{
    modelId: "context-engine-v1",
    probability: 0.61,
    audit: { independentPredictiveModel: false, deterministic: true, chronologySafe: true }
  }];

  const result = buildEnsembleSnapshotV1(pick, { counts: { rejected: 0 } }, { now: NOW });
  assert.equal(result.models[0].eligibleForResearch, false);
  assert.ok(result.models[0].rejectionReasons.includes("not-independent-predictive-model"));
  assert.equal(result.contract.contextModelsMayMasqueradeAsIndependentModels, false);
});

test("correlated variants in one dependence group receive only one top-level vote", () => {
  const pick = basePick();
  pick.independentModelOutputs = [
    calibratedModel("poisson-base", 0.62, 1, "goal-model-family"),
    calibratedModel("dixon-coles-variant", 0.58, 1, "goal-model-family"),
    calibratedModel("elo-rating", 0.54, 1, "rating-family")
  ];

  const result = buildEnsembleSnapshotV1(pick, { counts: { rejected: 0 } }, { now: NOW });

  assert.equal(result.counts.researchEligible, 3);
  assert.equal(result.counts.researchGroups, 2);
  assert.equal(result.counts.calibrationReadyGroups, 2);
  assert.equal(result.dependenceGroups.find((group) => group.dependenceGroup === "goal-model-family").memberCount, 2);
  assert.equal(result.shadowProbability, 0.57);
  assert.equal(result.calibratedShadowProbability, 0.57);
  assert.equal(result.weighting.dependenceGroupDoubleCountingAllowed, false);
  assert.equal(result.contract.correlatedModelVariantsDoubleCounted, false);
  assert.equal(result.researchRiskGate.decision, "REVIEW");
});

test("multiple variants from only one model family do not satisfy the independent-model gate", () => {
  const pick = basePick();
  pick.independentModelOutputs = [
    calibratedModel("poisson-base", 0.62, 1, "goal-model-family"),
    calibratedModel("dixon-coles-variant", 0.58, 1, "goal-model-family")
  ];

  const result = buildEnsembleSnapshotV1(pick, { counts: { rejected: 0 } }, { now: NOW });

  assert.equal(result.counts.researchEligible, 2);
  assert.equal(result.counts.researchGroups, 1);
  assert.equal(result.counts.calibrationReadyGroups, 1);
  assert.equal(result.shadowProbability, 0.6);
  assert.equal(result.calibratedShadowProbability, null);
  assert.equal(result.researchRiskGate.decision, "NO_BET");
  assert.ok(result.researchRiskGate.reasons.includes("fewer-than-two-independent-model-groups"));
  assert.ok(result.researchRiskGate.reasons.includes("fewer-than-two-calibration-ready-model-groups"));
});
