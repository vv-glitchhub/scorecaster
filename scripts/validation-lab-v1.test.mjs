import test from "node:test";
import assert from "node:assert/strict";
import { buildAdvancedModelHoldoutV1 } from "../lib/advanced-model-holdout-v1.mjs";
import { buildModelValidationEvidence, formatValidationMetric } from "../lib/validation-lab-v1.mjs";

const now = Date.parse("2026-09-09T12:00:00Z");
function fixture() {
  const snapshot = {
    event_id: "event-one", sport_key: "soccer_epl", canonical_sport: "soccer", league: "EPL",
    commence_time: "2026-08-20T18:00:00Z", captured_at: "2026-08-20T17:00:00Z",
    raw_summary: {
      shadowModels: [{ modelId: "independent-a", modelVersion: "1.0.0", sport: "soccer", inputSnapshotHash: "snapshot-one", predictionHorizon: "2026-08-20T17:00:00Z", homeTeam: "United", awayTeam: "City", probabilities: { home: 0.5, draw: 0.25, away: 0.25 } }],
      marketBenchmark: { version: "no-vig-event-market-benchmark-v1", capturedAt: "2026-08-20T17:00:00Z", probabilities: { home: 0.4, draw: 0.3, away: 0.3 } }
    }
  };
  const result = { id: "result-one", date: "2026-08-20", time: "18:00:00", home_team: "United", away_team: "City", home_score: 2, away_score: 1, is_finished: true };
  return { snapshot, result };
}
const report = (snapshot, results, clock = now) => buildAdvancedModelHoldoutV1([snapshot], results, { now: clock });

test("missing metrics stay missing while a real zero remains visible", () => {
  for (const value of [null, undefined, "", " ", false, true, [], {}, NaN, Infinity]) {
    assert.equal(formatValidationMetric(value), "—");
    assert.equal(formatValidationMetric(value, { percent: true }), "—");
  }
  assert.equal(formatValidationMetric(0), "0.0000");
  assert.equal(formatValidationMetric(0, { percent: true, digits: 1 }), "0.0%");
});

test("the exact final match produces valid paired metrics without a production skill claim", () => {
  const { snapshot, result } = fixture();
  const value = report(snapshot, [result]);
  assert.equal(value.counts.settledEvaluations, 1);
  assert.equal(value.models[0].marketBenchmark.sampleSize, 1);
  assert.equal(value.models[0].validationEvidence.stage, "early-stage");
  assert.equal(value.models[0].validationEvidence.productionReady, false);
});

for (const [name, change] of [
  ["unknown finality", (row) => { delete row.is_finished; }],
  ["unfinished result", (row) => { row.is_finished = false; }],
  ["a different same-named fixture three days later", (row) => { row.date = "2026-08-23"; }],
  ["a reserve team whose name contains the first-team name", (row) => { row.home_team = "United U21"; }],
  ["missing result date", (row) => { delete row.date; }],
  ["missing result time", (row) => { delete row.time; }],
  ["different league", (row) => { row.holdoutLeagueKey = "soccer_cup|Cup"; }],
  ["negative score", (row) => { row.home_score = -1; }],
  ["fractional score", (row) => { row.home_score = 2.5; }]
]) test(`holdout excludes ${name}`, () => {
  const { snapshot, result } = fixture(); change(result);
  const value = report(snapshot, [result]);
  assert.equal(value.counts.settledEvaluations, 0);
  assert.equal(value.models.length, 0);
});

test("ambiguous finals cannot be selected by provider order", () => {
  const { snapshot, result } = fixture();
  const conflicting = { ...result, home_score: 0 };
  for (const results of [[result, conflicting], [conflicting, result]]) assert.equal(report(snapshot, results).counts.settledEvaluations, 0);
  assert.equal(report(snapshot, [result, { ...result }]).counts.settledEvaluations, 1);
});

test("future fixtures cannot be settled by an incorrectly finished provider row", () => {
  const { snapshot, result } = fixture();
  assert.equal(report(snapshot, [result], Date.parse("2026-08-20T17:30:00Z")).counts.settledEvaluations, 0);
});

test("snapshots and market benchmarks exactly at kickoff are not pregame", () => {
  const { snapshot, result } = fixture();
  snapshot.captured_at = snapshot.commence_time;
  assert.equal(report(snapshot, [result]).counts.immutablePregamePredictions, 0);
  const fresh = fixture();
  fresh.snapshot.raw_summary.marketBenchmark.capturedAt = fresh.snapshot.commence_time;
  assert.equal(report(fresh.snapshot, [fresh.result]).counts.marketComparableEvaluations, 0);
});

test("invalid probabilities do not increase evaluated sample size", () => {
  const { snapshot, result } = fixture();
  snapshot.raw_summary.shadowModels[0].probabilities = { home: 0.9, draw: 0.4, away: 0.2 };
  assert.equal(report(snapshot, [result]).counts.settledEvaluations, 0);
});

test("distinct model IDs sharing a version are evaluated separately", () => {
  const { snapshot, result } = fixture();
  snapshot.raw_summary.shadowModels.push({ ...snapshot.raw_summary.shadowModels[0], modelId: "independent-b" });
  const value = report(snapshot, [result]);
  assert.equal(value.counts.immutablePregamePredictions, 2);
  assert.equal(value.models.length, 2);
  assert.deepEqual(value.models.map((model) => model.sampleSize), [1, 1]);
});

test("identical model versions in different leagues never inflate a single validation sample", () => {
  const { snapshot, result } = fixture();
  const another = { ...snapshot, event_id: "event-two", sport_key: "soccer_cup", league: "Cup" };
  const value = buildAdvancedModelHoldoutV1([snapshot, another], [{ ...result, holdoutLeagueKey: "soccer_epl|EPL" }, { ...result, holdoutLeagueKey: "soccer_cup|Cup" }], { now });
  assert.equal(value.models.length, 2);
  assert.deepEqual(value.models.map((model) => model.sampleSize), [1, 1]);
});

function evaluations() {
  return Array.from({ length: 120 }, (_, index) => ({
    commenceTime: new Date(Date.UTC(2026, 4 + Math.floor(index / 40), 1 + index % 28, 18)).toISOString(),
    brier: 0.1, marketBrier: 0.2, logLoss: 0.4, marketLogLoss: 0.6
  }));
}

test("repeated positive comparisons qualify only for research review", () => {
  const rows = evaluations();
  const result = buildModelValidationEvidence(rows, { now });
  assert.equal(result.stage, "research-review");
  assert.equal(result.completePeriods, 3);
  assert.equal(result.productionReady, false);
  assert.equal(result.prospectiveProtocolVerified, false);
  assert.equal(result.trainingProvenanceVerified, false);
  assert.equal(result.automaticPromotionAllowed, false);
  assert.deepEqual(result, buildModelValidationEvidence([...rows].reverse(), { now }));
});

test("a losing period cannot be hidden by an overall positive average", () => {
  const rows = evaluations().map((row, index) => index < 40 ? { ...row, brier: 0.21, logLoss: 0.61 } : row);
  const result = buildModelValidationEvidence(rows, { now });
  assert.equal(result.stage, "early-stage");
  assert.equal(result.checks.find((check) => check.id === "brier-improvement").passed, true);
  assert.equal(result.checks.find((check) => check.id === "repeatability").passed, false);
});

test("missing benchmark coverage and the current month cannot pass review", () => {
  const rows = evaluations();
  rows[0].marketBrier = null;
  assert.equal(buildModelValidationEvidence(rows, { now }).stage, "early-stage");
  const current = buildModelValidationEvidence(evaluations(), { now: Date.parse("2026-07-31T23:59:00Z") });
  assert.equal(current.completePeriods, 2);
  assert.equal(current.stage, "early-stage");
  const empty = buildModelValidationEvidence([], { now });
  assert.equal(empty.pairedCoverage, null);
  assert.equal(empty.checks.some((check) => check.passed), false);
});
