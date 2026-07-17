import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCalibrator,
  buildSelfLearningReport,
  normalizeLearningSamples,
  scoreCalibrator
} from "../lib/agent-self-learning.mjs";
import {
  applyModelLabSafety,
  summarizeGovernedDecisions
} from "../lib/agent-model-governance.mjs";

function row(index, probability, outcome) {
  return {
    id: `row-${index}`,
    result: outcome ? "win" : "loss",
    createdAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    modelProbability: probability,
    sportKey: "soccer_epl",
    marketKey: "h2h"
  };
}

test("normalizes only chronological binary outcomes with valid probabilities", () => {
  const samples = normalizeLearningSamples([
    row(2, 0.6, 1),
    { ...row(1, 0.4, 0), result: "push" },
    row(0, 0.55, 0),
    { ...row(3, 2, 1) }
  ]);

  assert.equal(samples.length, 2);
  assert.equal(samples[0].id, "row-0");
  assert.equal(samples[1].id, "row-2");
});

test("keeps the learning layer in shadow mode below the evidence threshold", () => {
  const report = buildSelfLearningReport(
    Array.from({ length: 50 }, (_, index) => row(index, 0.6, index % 5 < 3))
  );

  assert.equal(report.status, "insufficient-data");
  assert.equal(report.mode, "shadow-only");
  assert.equal(report.promotion.eligible, false);
  assert.equal(report.safety.probabilityAppliedToProduction, false);
});

test("selects and validates a challenger on an untouched chronological holdout", () => {
  const rows = Array.from({ length: 200 }, (_, index) => row(index, 0.8, index % 5 < 3));
  const report = buildSelfLearningReport(rows);

  assert.equal(report.trainSize + report.holdoutSize, 200);
  assert.notEqual(report.challenger.id, "identity");
  assert.ok(report.challenger.holdoutImprovement.brier > 0.005);
  assert.ok(report.challenger.holdoutImprovement.logLoss > 0);
  assert.equal(report.promotion.eligible, true);
  assert.equal(report.status, "promotion-ready");
  assert.equal(report.safety.candidateSelectedOnTrainingOnly, true);
  assert.equal(report.safety.evaluatedOnUntouchedHoldout, true);
  assert.equal(report.safety.probabilityAppliedToProduction, false);
});

test("detects severe recent drift and freezes promotion", () => {
  const stable = Array.from({ length: 170 }, (_, index) => row(index, 0.6, index % 5 < 3));
  const drifted = Array.from({ length: 30 }, (_, offset) => row(170 + offset, 0.9, offset % 5 === 0));
  const report = buildSelfLearningReport([...stable, ...drifted]);

  assert.equal(report.drift.status, "critical");
  assert.equal(report.status, "frozen-drift");
  assert.equal(report.promotion.eligible, false);
});

test("critical drift downgrades new PLAY exposure but preserves WATCH and SKIP", () => {
  const decisions = [
    { id: "a", decision: "PLAY", suggestedStake: 10, allocatedStake: 10, blockers: [] },
    { id: "b", decision: "WATCH", suggestedStake: 0, allocatedStake: 0, blockers: [] },
    { id: "c", decision: "SKIP", suggestedStake: 0, allocatedStake: 0, blockers: [] }
  ];
  const modelLab = {
    version: "V11-model-lab",
    status: "frozen-drift",
    mode: "shadow-only",
    sampleSize: 200,
    promotion: { eligible: false },
    drift: { status: "critical" }
  };

  const governed = applyModelLabSafety(decisions, modelLab);
  assert.equal(governed[0].decision, "WATCH");
  assert.equal(governed[0].suggestedStake, 0);
  assert.equal(governed[0].allocatedStake, 0);
  assert.equal(governed[1].decision, "WATCH");
  assert.equal(governed[2].decision, "SKIP");
  assert.equal(governed.every((item) => item.selfLearning.probabilityApplied === false), true);

  const summary = summarizeGovernedDecisions(governed);
  assert.deepEqual(summary.counts, { PLAY: 0, WATCH: 2, SKIP: 1 });
  assert.equal(summary.totalAllocated, 0);
});

test("calibrator scoring is deterministic and bounded", () => {
  const candidate = { type: "temperature", temperature: 1.3 };
  const first = applyCalibrator(0.8, candidate);
  const second = applyCalibrator(0.8, candidate);
  assert.equal(first, second);
  assert.ok(first > 0 && first < 1);

  const metrics = scoreCalibrator([
    { probability: 0.8, outcome: 1 },
    { probability: 0.8, outcome: 0 }
  ], candidate);
  assert.equal(metrics.count, 2);
  assert.ok(Number.isFinite(metrics.brierScore));
  assert.ok(Number.isFinite(metrics.logLoss));
});
