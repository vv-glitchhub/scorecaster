import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildShadowLearningCycle,
  normalizeShadowLearningSamples
} from "../lib/shadow-learning-v1.mjs";

function sample(index, {
  probability = 0.72,
  outcome = index % 5 < 3 ? "win" : "loss",
  clv = 0.02,
  stake = 5,
  odds = 1.9,
  closingOdds = 1.84
} = {}) {
  return {
    id: `sample-${index}`,
    result: outcome,
    original_probability: probability,
    odds_at_selection: odds,
    closing_odds: closingOdds,
    clv,
    stake,
    profit: outcome === "win" ? stake * (odds - 1) : -stake,
    sport: index % 2 ? "soccer_epl" : "basketball_nba",
    market: "h2h",
    model_version: "Autonomous-Scorecaster-V13",
    settled_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString()
  };
}

test("normalizes only settled binary observations with valid original probabilities", () => {
  const rows = normalizeShadowLearningSamples([
    sample(0),
    { ...sample(1), result: "push" },
    { ...sample(2), original_probability: 1.2 },
    { ...sample(3), result: null }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "sample-0");
  assert.equal(rows[0].probability, 0.72);
});

test("missing closing evidence stays null and does not create synthetic CLV", () => {
  const rows = normalizeShadowLearningSamples([
    sample(0, { clv: null, closingOdds: null })
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].clv, null);
  assert.equal(rows[0].closingOdds, null);

  const report = buildShadowLearningCycle(rows);
  assert.equal(report.sampleSize, 1);
  assert.equal(report.clvSample, 0);
  assert.equal(report.metrics.averageClv, null);
  assert.equal(report.metrics.positiveClvRate, null);
  assert.equal(report.promotion.automaticPromotionAllowed, false);
});

test("small samples remain in evidence collection and never enable automatic promotion", () => {
  const report = buildShadowLearningCycle(
    Array.from({ length: 120 }, (_, index) => sample(index))
  );
  assert.equal(report.status, "collecting-evidence");
  assert.equal(report.mode, "shadow-only");
  assert.equal(report.promotion.reviewReady, false);
  assert.equal(report.promotion.automaticPromotionAllowed, false);
  assert.equal(report.safety.productionProbabilityChanged, false);
  assert.equal(report.safety.automaticRealMoneyExecution, false);
});

test("negative CLV blocks review even with a large resolved sample", () => {
  const report = buildShadowLearningCycle(
    Array.from({ length: 360 }, (_, index) => sample(index, { clv: -0.03, closingOdds: 2.0 }))
  );
  assert.equal(report.gates.settledSample, true);
  assert.equal(report.gates.clvSample, true);
  assert.equal(report.gates.positiveAverageClv, false);
  assert.equal(report.promotion.reviewReady, false);
  assert.equal(report.promotion.automaticPromotionAllowed, false);
});

test("a review-ready challenger remains shadow-only and requires human approval", () => {
  const report = buildShadowLearningCycle(
    Array.from({ length: 360 }, (_, index) => sample(index, {
      probability: 0.82,
      outcome: index % 5 < 3 ? "win" : "loss",
      clv: 0.025
    }))
  );
  assert.equal(report.sampleSize, 360);
  assert.equal(report.clvSample, 360);
  assert.equal(report.metrics.averageClv, 0.025);
  assert.equal(report.promotion.automaticPromotionAllowed, false);
  assert.equal(report.safety.originalProbabilityImmutable, true);
  assert.equal(report.safety.contextCanUpgradeToPlay, false);
  assert.equal(report.safety.automaticRealMoneyExecution, false);
});

test("settlement worker batches RPC writes and the candidate lookup has a partial index", async () => {
  const [route, migration] = await Promise.all([
    readFile(new URL("../app/api/internal/shadow-candidate-settlement/route.js", import.meta.url), "utf8"),
    readFile(new URL("../supabase/scorecaster_shadow_candidate_settlement_performance_v2.sql", import.meta.url), "utf8")
  ]);
  assert.match(route, /const SETTLEMENT_RPC_BATCH_SIZE = 100/);
  assert.match(route, /index \+= SETTLEMENT_RPC_BATCH_SIZE/);
  assert.match(route, /updates\.slice\(index, index \+ SETTLEMENT_RPC_BATCH_SIZE\)/);
  assert.match(migration, /idx_autonomous_audit_open_settlement_candidates_v2/);
  assert.match(migration, /where settlement_status = 'open'/);
  assert.match(migration, /event_id is not null/);
  assert.match(migration, /model_probability is not null/);
});
