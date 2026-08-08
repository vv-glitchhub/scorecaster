import test from "node:test";
import assert from "node:assert/strict";

import { buildTransparent1X2EvaluationPackage } from "../lib/transparent-1x2-evaluation-package.mjs";
import { compareTransparent1X2EvaluationPackages } from "../lib/transparent-1x2-paired-evidence.mjs";

const manifest = {
  schemaVersion: 1,
  datasetId: "paired-failclosed-fixture",
  datasetKind: "synthetic-fixture",
  createdAt: "2026-06-01T12:00:00.000Z",
  dataCutoff: "2026-06-01T11:00:00.000Z",
  rightsStatus: "synthetic",
  marketBenchmarkType: "no-vig-prediction-time",
  sourceIds: ["synthetic-paired-failclosed"],
  containsPersonalData: false,
  containsRestrictedRawPayload: false
};

const options = { minimumSample: 10, minimumTrain: 6, testWindow: 3, binCount: 10 };

function records(modelVersion = "baseline", shift = 0) {
  const outcomes = ["home", "draw", "away"];
  return Array.from({ length: 12 }, (_, index) => {
    const kickoff = new Date(Date.UTC(2026, 4, 1 + index, 18, 0, 0));
    const predicted = new Date(kickoff.getTime() - 24 * 60 * 60 * 1000);
    return {
      id: `fc-${index}`,
      predictedAt: predicted.toISOString(),
      kickoffAt: kickoff.toISOString(),
      trainingCutoff: new Date(predicted.getTime() - 60 * 60 * 1000).toISOString(),
      marketObservedAt: new Date(predicted.getTime() - 5 * 60 * 1000).toISOString(),
      outcomeObservedAt: new Date(kickoff.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      probabilities: { home: 0.4 + shift, draw: 0.32, away: 0.28 - shift },
      marketProbabilities: { home: 0.44, draw: 0.29, away: 0.27 },
      outcome: outcomes[index % outcomes.length],
      league: "Synthetic",
      season: "test",
      market: "h2h",
      provider: "synthetic-benchmark",
      decisionClass: "WATCH",
      modelVersion
    };
  });
}

function pair() {
  return {
    baseline: buildTransparent1X2EvaluationPackage({ manifest, records: records("baseline", 0), options }),
    challenger: buildTransparent1X2EvaluationPackage({ manifest, records: records("challenger", 0.01), options })
  };
}

test("missing numeric metrics remain missing instead of becoming invented zeros", () => {
  const { baseline, challenger } = pair();
  baseline.evaluation.model.brier = null;
  const result = compareTransparent1X2EvaluationPackages({ baseline, challenger });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("baseline-model-metrics-missing"));
  assert.equal(result.metrics.deltaChallengerMinusBaseline.brier, null);
  assert.equal(result.metrics.direction.brier, "unavailable");
});

test("tampered package safety boundary fails closed", () => {
  for (const field of ["automaticPromotionAllowed", "productionProbabilityChanged", "paperOnly"]) {
    const { baseline, challenger } = pair();
    baseline[field] = field === "paperOnly" ? false : true;
    const result = compareTransparent1X2EvaluationPackages({ baseline, challenger });
    assert.equal(result.ok, false);
    assert.ok(result.failures.includes("baseline-safety-boundary-invalid"));
  }
});

test("missing fingerprints cannot be treated as a valid pair", () => {
  for (const field of ["packageId", "configurationFingerprint", "resultFingerprint"]) {
    const { baseline, challenger } = pair();
    if (field === "configurationFingerprint" || field === "resultFingerprint") baseline[field] = null;
    else baseline[field] = null;
    const result = compareTransparent1X2EvaluationPackages({ baseline, challenger });
    assert.equal(result.ok, false);
  }

  for (const field of ["datasetFingerprint", "predictionFingerprint", "cohortFingerprint"]) {
    const { baseline, challenger } = pair();
    baseline.dataset[field] = null;
    const result = compareTransparent1X2EvaluationPackages({ baseline, challenger });
    assert.equal(result.ok, false);
  }
});

test("unsupported evaluation package version fails closed", () => {
  const { baseline, challenger } = pair();
  challenger.version = "unknown-evaluation-package";
  const result = compareTransparent1X2EvaluationPackages({ baseline, challenger });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("challenger-package-version-unsupported"));
});

test("dataset identity tampering fails even when cohort fingerprint is left unchanged", () => {
  const { baseline, challenger } = pair();
  challenger.dataset.datasetId = "tampered-dataset-id";
  const result = compareTransparent1X2EvaluationPackages({ baseline, challenger });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("dataset-id-mismatch"));
});

test("missing chronological folds cannot pass a paired review gate", () => {
  const { baseline, challenger } = pair();
  challenger.evaluation.chronologicalFolds = [];
  const result = compareTransparent1X2EvaluationPackages({ baseline, challenger });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("chronological-fold-mismatch"));
});
