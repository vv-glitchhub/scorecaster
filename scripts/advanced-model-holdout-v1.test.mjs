import test from "node:test";
import assert from "node:assert/strict";
import { buildAdvancedModelHoldoutV1 } from "../lib/advanced-model-holdout-v1.mjs";

function soccerSnapshot(index, captureOffsetMinutes = -60, probabilityShift = 0) {
  const commence = new Date(Date.UTC(2026, 7, 1 + index, 18, 0, 0));
  const captured = new Date(commence.getTime() + captureOffsetMinutes * 60_000);
  return {
    event_id: `soccer-${index}`,
    sport_key: "soccer_epl",
    canonical_sport: "soccer",
    league: "EPL",
    commence_time: commence.toISOString(),
    captured_at: captured.toISOString(),
    raw_summary: {
      shadowModels: [{
        modelId: "soccer-xg-poisson-v1",
        modelVersion: "soccer-xg-poisson-shadow-v1",
        family: "expected-performance",
        sport: "soccer",
        generatedAt: captured.toISOString(),
        predictionHorizon: captured.toISOString(),
        inputSnapshotHash: `hash-${index}-${captureOffsetMinutes}`,
        homeTeam: `Home ${index}`,
        awayTeam: `Away ${index}`,
        probabilities: {
          home: 0.5 + probabilityShift,
          draw: 0.25,
          away: 0.25 - probabilityShift
        },
        providers: ["licensed-xg-provider"],
        metrics: ["xg-for-per-90", "xg-against-per-90"]
      }]
    }
  };
}

function soccerResult(index, outcome = "home") {
  const date = new Date(Date.UTC(2026, 7, 1 + index, 18, 0, 0));
  const scores = outcome === "home" ? [2, 1] : outcome === "draw" ? [1, 1] : [0, 2];
  return {
    id: `result-${index}`,
    date: date.toISOString().slice(0, 10),
    time: "18:00:00",
    home_team: `Home ${index}`,
    away_team: `Away ${index}`,
    home_score: scores[0],
    away_score: scores[1],
    is_finished: true
  };
}

function basketballSnapshot(index, { league = "NBA", modelVersion = "nba-efficiency-pace-shadow-v1", probability = 0.62 } = {}) {
  const commence = new Date(Date.UTC(2026, 9, 1 + index, 23, 0, 0));
  const captured = new Date(commence.getTime() - 45 * 60_000);
  const prefix = league === "WNBA" ? "wnba" : "nba";
  return {
    event_id: `${prefix}-${index}`,
    sport_key: league === "WNBA" ? "basketball_wnba" : "basketball_nba",
    canonical_sport: "basketball",
    league,
    commence_time: commence.toISOString(),
    captured_at: captured.toISOString(),
    raw_summary: {
      shadowModels: [{
        modelId: league === "WNBA" ? "wnba-efficiency-pace-v1" : "nba-efficiency-pace-v1",
        modelVersion,
        family: "performance-statistics",
        sport: "basketball",
        generatedAt: captured.toISOString(),
        predictionHorizon: captured.toISOString(),
        inputSnapshotHash: `${prefix}-hash-${index}`,
        homeTeam: `${league} Home ${index}`,
        awayTeam: `${league} Away ${index}`,
        probabilities: { home: probability, away: 1 - probability },
        providers: ["licensed-basketball-provider"],
        metrics: ["pace", "offensive-rating", "defensive-rating"]
      }]
    }
  };
}

function basketballResult(index, { league = "NBA", homeWin = true } = {}) {
  const date = new Date(Date.UTC(2026, 9, 1 + index, 23, 0, 0));
  return {
    id: `${league}-result-${index}`,
    date: date.toISOString().slice(0, 10),
    time: "23:00:00",
    home_team: `${league} Home ${index}`,
    away_team: `${league} Away ${index}`,
    home_score: homeWin ? 112 : 101,
    away_score: homeWin ? 104 : 109,
    is_finished: true
  };
}

test("holdout uses the latest immutable pregame capture and ignores post-start snapshots", () => {
  const rows = [
    soccerSnapshot(0, -120, -0.1),
    soccerSnapshot(0, -30, 0.1),
    soccerSnapshot(0, 10, -0.2)
  ];
  const report = buildAdvancedModelHoldoutV1(rows, [soccerResult(0, "home")], { now: Date.parse("2026-08-20T00:00:00.000Z") });
  assert.equal(report.counts.immutablePregamePredictions, 1);
  assert.equal(report.counts.settledEvaluations, 1);
  assert.equal(report.models[0].sampleSize, 1);
  assert.equal(report.models[0].status, "insufficient");
  assert.equal(report.models[0].ensembleWeightAvailable, false);
  assert.equal(report.contracts.postStartPredictionAccepted, false);
});

test("holdout refuses snapshots without an input snapshot hash", () => {
  const row = soccerSnapshot(1, -60, 0);
  row.raw_summary.shadowModels[0].inputSnapshotHash = "";
  const report = buildAdvancedModelHoldoutV1([row], [soccerResult(1, "home")]);
  assert.equal(report.counts.immutablePregamePredictions, 0);
  assert.equal(report.counts.settledEvaluations, 0);
});

test("100 chronological settled predictions become review-ready but never get an invented ensemble weight", () => {
  const snapshots = [];
  const results = [];
  for (let index = 0; index < 100; index += 1) {
    snapshots.push(soccerSnapshot(index, -45, index % 2 === 0 ? 0.05 : -0.05));
    results.push(soccerResult(index, index % 3 === 0 ? "draw" : index % 2 === 0 ? "home" : "away"));
  }
  const report = buildAdvancedModelHoldoutV1(snapshots, results, { now: Date.parse("2027-01-01T00:00:00.000Z") });
  assert.equal(report.models.length, 1);
  const model = report.models[0];
  assert.equal(model.sampleSize, 100);
  assert.equal(model.status, "review-ready");
  assert.equal(model.reviewEligibleBySample, true);
  assert.equal(model.ensembleWeightAvailable, false);
  assert.equal(model.performanceEvidenceDraft.performanceWeight, null);
  assert.equal(model.performanceEvidenceDraft.weightSource, null);
  assert.equal(model.performanceEvidenceDraft.preEventOnly, true);
  assert.equal(model.performanceEvidenceDraft.closingLineLeakage, false);
});

test("basketball H2H predictions are evaluated with binary Brier and log loss", () => {
  const snapshot = basketballSnapshot(0, { probability: 0.7 });
  const result = basketballResult(0, { homeWin: true });
  const report = buildAdvancedModelHoldoutV1([snapshot], [result], { now: Date.parse("2026-11-01T00:00:00.000Z") });
  assert.equal(report.counts.settledEvaluations, 1);
  assert.equal(report.models.length, 1);
  assert.equal(report.models[0].sport, "basketball");
  assert.equal(report.models[0].sampleSize, 1);
  assert.equal(report.models[0].brier, 0.09);
  assert.ok(report.models[0].logLoss > 0);
  assert.equal(report.models[0].performanceEvidenceDraft.scope.market, "h2h");
});

test("NBA and WNBA holdout samples stay separated by modelVersion", () => {
  const snapshots = [
    basketballSnapshot(1, { league: "NBA", modelVersion: "nba-efficiency-pace-shadow-v1" }),
    basketballSnapshot(2, { league: "WNBA", modelVersion: "wnba-efficiency-pace-shadow-v1" })
  ];
  const results = [
    basketballResult(1, { league: "NBA", homeWin: true }),
    basketballResult(2, { league: "WNBA", homeWin: false })
  ];
  const report = buildAdvancedModelHoldoutV1(snapshots, results, { now: Date.parse("2026-11-10T00:00:00.000Z") });
  assert.equal(report.models.length, 2);
  assert.deepEqual(report.models.map((model) => model.modelVersion).sort(), [
    "nba-efficiency-pace-shadow-v1",
    "wnba-efficiency-pace-shadow-v1"
  ]);
  assert.equal(report.models.every((model) => model.sampleSize === 1), true);
  assert.equal(report.models.every((model) => model.ensembleWeightAvailable === false), true);
});
