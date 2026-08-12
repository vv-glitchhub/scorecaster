import test from "node:test";
import assert from "node:assert/strict";
import { buildUncertaintyEngineV1 } from "../lib/uncertainty-engine-v1.mjs";

function baseEnsemble(overrides = {}) {
  return {
    counts: { researchGroups: 3, calibrationReadyGroups: 3 },
    uncertainty: { band: "low", standardDeviation: 0.02, range: 0.05 },
    marketBenchmark: { probability: 0.52 },
    models: [
      { eligibleForDecisionWeight: true, performance: { calibrationGap: 0.02 } },
      { eligibleForDecisionWeight: true, performance: { calibrationGap: 0.03 } }
    ],
    ...overrides
  };
}

function goodPick() {
  return {
    intelligenceFusionV2: {
      trust: { score: 0.86 },
      coverage: { coverageRate: 0.82 },
      dataQualityGate: { safeForAi: true }
    }
  };
}

test("missing trust and coverage fail closed instead of being treated as neutral", () => {
  const report = buildUncertaintyEngineV1({}, { ensembleEngine: baseEnsemble() });
  assert.equal(report.researchDecision, "NO_BET");
  assert.equal(report.band, "high");
  assert.ok(report.criticalReasons.includes("data-trust-missing"));
  assert.ok(report.criticalReasons.includes("verified-data-coverage-missing"));
  assert.equal(report.contract.missingTrustFailsClosed, true);
  assert.equal(report.contract.missingCoverageFailsClosed, true);
});

test("good data, three independent calibrated groups and low disagreement can reach REVIEW", () => {
  const report = buildUncertaintyEngineV1(goodPick(), {
    ensembleEngine: baseEnsemble(),
    featureEngine: { counts: { rejected: 0 } },
    modelFactory: { counts: { rejectedOutputs: 0 } }
  });
  assert.equal(report.researchDecision, "REVIEW");
  assert.equal(report.band, "low");
  assert.equal(report.criticalReasons.length, 0);
  assert.ok(report.uncertaintyIndex < 25);
  assert.equal(report.contract.productionProbabilityChanged, false);
  assert.equal(report.contract.productionDecisionChanged, false);
});

test("high model disagreement blocks research even with otherwise strong evidence", () => {
  const report = buildUncertaintyEngineV1(goodPick(), {
    ensembleEngine: baseEnsemble({ uncertainty: { band: "high", standardDeviation: 0.11, range: 0.25 } })
  });
  assert.equal(report.researchDecision, "NO_BET");
  assert.ok(report.criticalReasons.includes("high-model-disagreement"));
});

test("fewer than two independent or calibration-ready groups are critical blockers", () => {
  const report = buildUncertaintyEngineV1(goodPick(), {
    ensembleEngine: baseEnsemble({ counts: { researchGroups: 1, calibrationReadyGroups: 0 } })
  });
  assert.equal(report.researchDecision, "NO_BET");
  assert.ok(report.criticalReasons.includes("fewer-than-two-independent-model-groups"));
  assert.ok(report.criticalReasons.includes("fewer-than-two-calibration-ready-model-groups"));
});

test("uncertainty index is explicitly not a probability confidence interval", () => {
  const report = buildUncertaintyEngineV1(goodPick(), { ensembleEngine: baseEnsemble() });
  assert.equal(report.contract.indexIsHeuristicEvidenceRiskNotProbability, true);
  assert.equal(report.contract.pseudoConfidenceIntervalPublished, false);
  assert.equal(Object.hasOwn(report, "confidenceInterval"), false);
});
