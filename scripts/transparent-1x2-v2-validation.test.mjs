import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildTransparent1X2 } from "../lib/transparent-1x2-engine.mjs";
import { buildDixonColes1X2, DIXON_COLES_1X2_VERSION } from "../lib/dixon-coles-1x2.mjs";
import { buildTransparent1X2V2, TRANSPARENT_1X2_V2_VERSION } from "../lib/transparent-1x2-v2.mjs";
import { evaluateTransparent1X2Backtest, TRANSPARENT_1X2_VALIDATION_VERSION } from "../lib/transparent-1x2-validation.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");
const generatedAt = "2026-08-01T12:00:00.000Z";
const homeTeam = { team: "Home", rating: 1600, attack: 63, defense: 59, form: 0.06 };
const awayTeam = { team: "Away", rating: 1540, attack: 57, defense: 55, form: 0.01 };

function input(overrides = {}) {
  return {
    homeTeam,
    awayTeam,
    generatedAt,
    marketOdds: { home: 2.05, draw: 3.45, away: 3.75 },
    trainingEvidence: { sampleScore: 0.6, calibrationScore: 0.4 },
    ...overrides
  };
}

function total(probabilities) {
  return probabilities.home + probabilities.draw + probabilities.away;
}

function syntheticRows(count = 18) {
  const outcomes = ["home", "draw", "away"];
  return Array.from({ length: count }, (_, index) => {
    const kickoff = new Date(Date.UTC(2026, 0, 2 + index, 18, 0, 0));
    const predicted = new Date(kickoff.getTime() - 24 * 60 * 60 * 1000);
    const trainingCutoff = new Date(predicted.getTime() - 60 * 60 * 1000);
    const home = 0.48 + ((index % 3) - 1) * 0.01;
    const draw = 0.27;
    const away = 1 - home - draw;
    return {
      id: `evt-${index}`,
      predictedAt: predicted.toISOString(),
      kickoffAt: kickoff.toISOString(),
      trainingCutoff: trainingCutoff.toISOString(),
      probabilities: { home, draw, away },
      marketProbabilities: { home: 0.45, draw: 0.28, away: 0.27 },
      outcome: outcomes[index % outcomes.length],
      league: index % 2 ? "League A" : "League B",
      season: "2025-26",
      market: "h2h",
      provider: index % 2 ? "provider-a" : "provider-b",
      decisionClass: index % 4 === 0 ? "PLAY" : "WATCH",
      modelVersion: "test-model-v1"
    };
  });
}

test("Dixon-Coles rho zero reproduces independent Poisson within the exposed xG rounding", () => {
  const baseline = buildTransparent1X2(input());
  const challenger = buildDixonColes1X2({
    homeLambda: baseline.expectedGoals.home,
    awayLambda: baseline.expectedGoals.away,
    rho: 0
  });

  assert.equal(challenger.ok, true);
  assert.equal(challenger.version, DIXON_COLES_1X2_VERSION);
  assert.equal(challenger.correctionApplied, false);
  for (const key of ["home", "draw", "away"]) {
    assert.ok(Math.abs(challenger.probabilities[key] - baseline.components.poisson.probabilities[key]) < 0.001);
  }
  assert.ok(Math.abs(total(challenger.probabilities) - 1) < 0.00001);
});

test("a non-zero Dixon-Coles rho changes only the offline challenger and stays normalized", () => {
  const baseline = buildTransparent1X2(input());
  const neutral = buildDixonColes1X2({ homeLambda: baseline.expectedGoals.home, awayLambda: baseline.expectedGoals.away, rho: 0 });
  const adjusted = buildDixonColes1X2({ homeLambda: baseline.expectedGoals.home, awayLambda: baseline.expectedGoals.away, rho: -0.08 });

  assert.equal(adjusted.ok, true);
  assert.equal(adjusted.correctionApplied, true);
  assert.notDeepEqual(adjusted.probabilities, neutral.probabilities);
  assert.ok(Math.abs(total(adjusted.probabilities) - 1) < 0.00001);
  assert.equal(adjusted.canPromotePlayByItself, false);
  assert.equal(adjusted.paperOnly, true);
});

test("V2 keeps production probabilities identical to V1 when challenger evidence is unvalidated", () => {
  const baseline = buildTransparent1X2(input());
  const v2 = buildTransparent1X2V2(input(), {
    challengerProfile: {
      status: "draft",
      rho: -0.1,
      sampleSize: 1000,
      trainingCutoff: "2026-07-01T00:00:00.000Z"
    }
  });

  assert.equal(v2.ok, true);
  assert.equal(v2.modelVersion, TRANSPARENT_1X2_V2_VERSION);
  assert.deepEqual(v2.probabilities, baseline.probabilities);
  assert.deepEqual(v2.productionProbabilities, baseline.probabilities);
  assert.equal(v2.productionProbabilityChangedByChallenger, false);
  assert.equal(v2.challenger.profile.valid, false);
  assert.equal(v2.challenger.canAffectProductionDecision, false);
  assert.equal(v2.validationContract.automaticPromotionAllowed, false);
});

test("a chronology-safe validated challenger is visible offline but still cannot change production", () => {
  const baseline = buildTransparent1X2(input());
  const v2 = buildTransparent1X2V2(input(), {
    challengerProfile: {
      status: "validated",
      profileId: "dc-league-a-v1",
      rho: -0.06,
      sampleSize: 400,
      trainingCutoff: "2026-07-31T00:00:00.000Z"
    }
  });

  assert.equal(v2.ok, true);
  assert.equal(v2.challenger.profile.valid, true);
  assert.equal(v2.challenger.eligibleForOfflineComparison, true);
  assert.equal(v2.challenger.dixonColes.correctionApplied, true);
  assert.deepEqual(v2.probabilities, baseline.probabilities);
  assert.equal(v2.productionProbabilityChangedByChallenger, false);
  assert.equal(v2.challenger.canAffectProductionDecision, false);
});

test("a future training cutoff fails closed even when a challenger calls itself validated", () => {
  const v2 = buildTransparent1X2V2(input(), {
    challengerProfile: {
      status: "validated",
      profileId: "invalid-future-profile",
      rho: -0.05,
      sampleSize: 500,
      trainingCutoff: "2026-08-02T00:00:00.000Z"
    }
  });

  assert.equal(v2.ok, false);
  assert.equal(v2.reason, "challenger-profile-chronology-violation");
  assert.equal(v2.productionProbabilityChangedByChallenger, false);
  assert.equal(v2.paperOnly, true);
});

test("chronology-safe validation scores Brier, log loss, market benchmark, bins, slices and rolling folds", () => {
  const result = evaluateTransparent1X2Backtest(syntheticRows(18), {
    generatedAt,
    minimumSample: 12,
    minimumTrain: 6,
    testWindow: 3,
    binCount: 10
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, TRANSPARENT_1X2_VALIDATION_VERSION);
  assert.equal(result.receivedRows, 18);
  assert.equal(result.eligibleRows, 18);
  assert.equal(result.excludedRows, 0);
  assert.equal(result.model.samples, 18);
  assert.equal(result.model.brierDenominator, 18);
  assert.equal(result.model.logLossDenominator, 18);
  assert.ok(result.model.brier > 0);
  assert.ok(result.model.logLoss > 0);
  assert.equal(result.marketBenchmark.samples, 18);
  assert.equal(result.calibration.bins.reduce((sum, bin) => sum + bin.observations, 0), 54);
  assert.equal(result.classBalance.home.count, 6);
  assert.equal(result.classBalance.draw.count, 6);
  assert.equal(result.classBalance.away.count, 6);
  assert.equal(result.slices.league.length, 2);
  assert.equal(result.slices.provider.length, 2);
  assert.equal(result.chronologicalFolds.length, 4);
  assert.ok(result.chronologicalFolds.every((fold) => fold.trainingChronologySafe));
  assert.equal(result.sampleAssessment.sufficient, true);
  assert.equal(result.automaticPromotionAllowed, false);
  assert.equal(result.leakageBoundary.closingLineUsedAsModelInput, false);
});

test("validation excludes prediction leakage and training-cutoff leakage instead of scoring it", () => {
  const rows = syntheticRows(4);
  rows.push({
    ...syntheticRows(1)[0],
    id: "at-kickoff",
    predictedAt: "2026-01-02T18:00:00.000Z",
    kickoffAt: "2026-01-02T18:00:00.000Z"
  });
  rows.push({
    ...syntheticRows(1)[0],
    id: "future-training",
    predictedAt: "2026-01-01T18:00:00.000Z",
    kickoffAt: "2026-01-02T18:00:00.000Z",
    trainingCutoff: "2026-01-01T19:00:00.000Z"
  });

  const result = evaluateTransparent1X2Backtest(rows, { generatedAt, minimumSample: 10 });
  const exclusions = Object.fromEntries(result.exclusions.map((item) => [item.reason, item.count]));
  assert.equal(result.receivedRows, 6);
  assert.equal(result.eligibleRows, 4);
  assert.equal(result.excludedRows, 2);
  assert.equal(exclusions["prediction-not-prestart"], 1);
  assert.equal(exclusions["training-cutoff-after-prediction"], 1);
  assert.equal(result.sampleAssessment.sufficient, false);
  assert.equal(result.sampleAssessment.label, "small-sample-do-not-promote");
});

test("the public 1X2 API exposes V2 evidence without a challenger input or closing-line path", async () => {
  const api = await file("app/api/1x2/route.js");
  assert.match(api, /buildTransparent1X2V2/);
  assert.match(api, /challengerChangesProductionProbability: false/);
  assert.match(api, /automaticModelPromotion: false/);
  assert.match(api, /closingLineUsed: false/);
  assert.match(api, /postKickoffDataUsed: false/);
  assert.doesNotMatch(api, /challengerProfile.*searchParams|rho.*searchParams/i);
  assert.doesNotMatch(api, /closing_odds|closing_line|settled_at/i);
});
