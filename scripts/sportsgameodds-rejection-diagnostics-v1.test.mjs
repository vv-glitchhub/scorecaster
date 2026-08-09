import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSportsGameOddsCandidates,
  safeSportsGameOddsMatchDiagnostics,
  SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE,
  SPORTSGAMEODDS_MIN_TEAM_SIMILARITY,
  SPORTSGAMEODDS_TIME_WINDOW_HOURS
} from "../lib/sportsgameodds-match-v3.mjs";

const START = "2026-08-09T18:00:00.000Z";
const match = (homeTeam = "Alpha United", awayTeam = "Beta City", commenceTime = START) => ({ homeTeam, awayTeam, commenceTime });
const event = (homeTeam, awayTeam, startsAt = START) => ({ homeTeam, awayTeam, startsAt });

test("direct exact match passes all unchanged safety gates", () => {
  const result = evaluateSportsGameOddsCandidates([
    event("Alpha United", "Beta City")
  ], match());
  assert.equal(result.diagnostics.rejectionReason, "matched");
  assert.equal(result.diagnostics.candidateCount, 1);
  assert.equal(result.diagnostics.orientationCount, 2);
  assert.equal(result.diagnostics.teamEligibleCount, 1);
  assert.equal(result.diagnostics.timeEligibleCount, 1);
  assert.equal(result.diagnostics.thresholdEligibleCount, 1);
  assert.equal(result.matchResult?.swapped, false);
  assert.equal(result.matchResult?.confidence, 1);
});

test("swapped provider orientation is evaluated and selected deterministically", () => {
  const result = evaluateSportsGameOddsCandidates([
    event("Beta City", "Alpha United")
  ], match());
  assert.equal(result.diagnostics.rejectionReason, "matched");
  assert.equal(result.matchResult?.swapped, true);
  assert.equal(result.diagnostics.bestHomeSimilarity, 1);
  assert.equal(result.diagnostics.bestAwaySimilarity, 1);
});

test("empty provider response is classified as no_candidates", () => {
  const result = evaluateSportsGameOddsCandidates([], match());
  assert.equal(result.matchResult, null);
  assert.equal(result.diagnostics.rejectionReason, "no_candidates");
  assert.equal(result.diagnostics.candidateCount, 0);
  assert.equal(result.diagnostics.orientationCount, 0);
});

test("team mismatch is separated from time and confidence failures", () => {
  const result = evaluateSportsGameOddsCandidates([
    event("Orange Tigers", "Blue Hawks")
  ], match());
  assert.equal(result.matchResult, null);
  assert.equal(result.diagnostics.rejectionReason, "team_similarity");
  assert.equal(result.diagnostics.teamEligibleCount, 0);
  assert.equal(result.diagnostics.timeEligibleCount, 0);
  assert.equal(result.diagnostics.thresholdEligibleCount, 0);
});

test("team-qualified event outside eight-hour window is classified as time_window", () => {
  const nineHoursLater = "2026-08-10T03:00:00.000Z";
  const result = evaluateSportsGameOddsCandidates([
    event("Alpha United", "Beta City", nineHoursLater)
  ], match());
  assert.equal(result.matchResult, null);
  assert.equal(result.diagnostics.rejectionReason, "time_window");
  assert.equal(result.diagnostics.teamEligibleCount, 1);
  assert.equal(result.diagnostics.timeEligibleCount, 0);
  assert.equal(result.diagnostics.bestTimeDifferenceHours, 9);
});

test("approximate team match above per-side gate but below final confidence is classified separately", () => {
  const result = evaluateSportsGameOddsCandidates([
    event("Alpha Beta Delta Epsilon", "North South West Central")
  ], match("Alpha Beta Gamma", "North South East"));
  assert.ok(result.matchResult);
  assert.equal(result.diagnostics.rejectionReason, "confidence_threshold");
  assert.equal(result.diagnostics.teamEligibleCount, 1);
  assert.equal(result.diagnostics.timeEligibleCount, 1);
  assert.equal(result.diagnostics.thresholdEligibleCount, 0);
  assert.ok(result.matchResult.confidence < SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE);
  assert.ok(result.diagnostics.bestHomeSimilarity >= SPORTSGAMEODDS_MIN_TEAM_SIMILARITY);
  assert.ok(result.diagnostics.bestAwaySimilarity >= SPORTSGAMEODDS_MIN_TEAM_SIMILARITY);
});

test("safe diagnostics expose only allowlisted numeric rejection evidence", () => {
  const safe = safeSportsGameOddsMatchDiagnostics({
    rejectionReason: "team_similarity",
    candidateCount: 5.9,
    orientationCount: 11,
    teamEligibleCount: -3,
    timeEligibleCount: 2,
    thresholdEligibleCount: 1,
    bestConfidence: 1.5,
    bestHomeSimilarity: 0.83,
    bestAwaySimilarity: -2,
    bestTimeDifferenceHours: 3.456,
    providerHomeTeam: "must-not-leak",
    providerAwayTeam: "must-not-leak",
    eventId: "must-not-leak"
  });
  assert.equal(safe.rejectionReason, "team_similarity");
  assert.equal(safe.candidateCount, 5);
  assert.equal(safe.teamEligibleCount, 0);
  assert.equal(safe.bestConfidence, 1);
  assert.equal(safe.bestAwaySimilarity, 0);
  assert.equal(safe.bestTimeDifferenceHours, 3.46);
  assert.equal(safe.teamSimilarityThreshold, 0.55);
  assert.equal(safe.timeWindowHours, 8);
  assert.equal(safe.matchConfidenceThreshold, 0.72);
  assert.deepEqual(Object.keys(safe).sort(), [
    "bestAwaySimilarity",
    "bestConfidence",
    "bestHomeSimilarity",
    "bestTimeDifferenceHours",
    "candidateCount",
    "matchConfidenceThreshold",
    "orientationCount",
    "rejectionReason",
    "teamEligibleCount",
    "teamSimilarityThreshold",
    "thresholdEligibleCount",
    "timeEligibleCount",
    "timeWindowHours"
  ].sort());
  assert.doesNotMatch(JSON.stringify(safe), /must-not-leak|eventId|providerHomeTeam|providerAwayTeam/);
});

test("diagnostic thresholds remain fixed at 0.55 / 8h / 0.72", () => {
  assert.equal(SPORTSGAMEODDS_MIN_TEAM_SIMILARITY, 0.55);
  assert.equal(SPORTSGAMEODDS_TIME_WINDOW_HOURS, 8);
  assert.equal(SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE, 0.72);
});
