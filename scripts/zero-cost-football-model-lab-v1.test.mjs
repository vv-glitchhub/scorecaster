import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalFootballTeam,
  noVigThreeWayProbabilities,
  parseFootballDataHistoricalCsv,
  runZeroCostFootballModelLab,
  ZERO_COST_FOOTBALL_MODEL_LAB_VERSION
} from "../lib/zero-cost-football-model-lab-v1.mjs";

function dateAt(index) {
  const date = new Date(Date.UTC(2015, 7, 1 + index));
  return date.toISOString().slice(0, 10);
}

function syntheticRows(count = 180) {
  const teams = [
    { name: "Alpha City", attack: 2.8, defense: 0.55 },
    { name: "Bravo United", attack: 2.0, defense: 0.9 },
    { name: "Charlie FC", attack: 1.15, defense: 1.55 },
    { name: "Delta Athletic", attack: 0.65, defense: 2.25 }
  ];
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const home = teams[index % teams.length];
    const away = teams[(index * 3 + 1) % teams.length];
    const homeXg = Math.max(0.2, (home.attack + away.defense) / 2 + 0.25);
    const awayXg = Math.max(0.2, (away.attack + home.defense) / 2 - 0.05);
    const homeGoals = homeXg - awayXg > 0.55 ? 3 : homeXg > awayXg ? 2 : homeXg + 0.2 < awayXg ? 0 : 1;
    const awayGoals = awayXg - homeXg > 0.55 ? 3 : awayXg > homeXg ? 2 : awayXg + 0.2 < homeXg ? 0 : 1;
    rows.push({
      date: dateAt(index),
      homeTeam: home.name,
      awayTeam: away.name,
      homeXg,
      awayXg,
      homeGoals,
      awayGoals,
      marketOdds: { home: 3.0, draw: 3.0, away: 3.0, source: "synthetic-market", timing: "pregame" }
    });
  }
  return rows;
}

test("team aliases normalize known StatsBomb / Football-Data differences", () => {
  assert.equal(canonicalFootballTeam("AFC Bournemouth"), "bournemouth");
  assert.equal(canonicalFootballTeam("Manchester United"), "man united");
  assert.equal(canonicalFootballTeam("West Bromwich Albion"), "west brom");
});

test("Football-Data parser prefers historical Pinnacle closing columns when available", () => {
  const csv = [
    "Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,PSCH,PSCD,PSCA,B365H,B365D,B365A",
    "08/08/15,Man United,Tottenham,1,0,H,1.70,3.80,5.80,1.65,4.00,6.00"
  ].join("\n");
  const rows = parseFootballDataHistoricalCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].marketOdds.source, "pinnacle-closing");
  assert.equal(rows[0].marketOdds.timing, "closing");
  assert.deepEqual(rows[0].marketOdds.columns, ["PSCH", "PSCD", "PSCA"]);
});

test("market probabilities are explicitly no-vig normalized", () => {
  const probabilities = noVigThreeWayProbabilities({ home: 2.0, draw: 3.5, away: 4.0 });
  const total = probabilities.home + probabilities.draw + probabilities.away;
  assert.ok(Math.abs(total - 1) < 1e-12);
  assert.ok(probabilities.overround > 0);
});

test("lab is chronological, research-only and cannot promote production decisions", () => {
  const report = runZeroCostFootballModelLab(syntheticRows(), { includeRows: true, bootstrapSamples: 300 });
  assert.equal(report.ok, true);
  assert.equal(report.version, ZERO_COST_FOOTBALL_MODEL_LAB_VERSION);
  assert.equal(report.methodology.chronologySafe, true);
  assert.equal(report.methodology.split, "chronological");
  assert.equal(report.methodology.stateUpdatesDuringHoldout, "after-each-completed-match-only");
  assert.equal(report.methodology.xgFeaturesFromTargetMatchAllowed, false);
  assert.equal(report.methodology.marketOddsUsedByChallenger, false);
  assert.equal(report.researchBoundary.researchOnly, true);
  assert.equal(report.researchBoundary.statsbombOpenDataProductionUseAllowed, false);
  assert.equal(report.researchBoundary.reportMayUpgradeProductionDecision, false);
  assert.equal(report.researchBoundary.reportMayPromoteModelAutomatically, false);
  assert.equal(report.researchBoundary.realMoneyActionAvailable, false);
  assert.equal(report.challenger.automaticPromotionAllowed, false);
  assert.ok(report.sampleSize >= 50);
});

test("target-match xG cannot leak into that match prediction", () => {
  const baselineRows = syntheticRows(120);
  const first = runZeroCostFootballModelLab(baselineRows, { includeRows: true, bootstrapSamples: 200 });
  const split = first.methodology.trainingRows;
  const mutated = baselineRows.map((row, index) => index === split ? { ...row, homeXg: 5.9, awayXg: 0.05 } : row);
  const second = runZeroCostFootballModelLab(mutated, { includeRows: true, bootstrapSamples: 200 });
  assert.deepEqual(first.rows[0].model, second.rows[0].model);
  assert.deepEqual(first.rows[0].projectedGoals, second.rows[0].projectedGoals);
});

test("paid-data recommendation needs the full gate set, never just a positive point estimate", () => {
  const report = runZeroCostFootballModelLab(syntheticRows(180), { bootstrapSamples: 300 });
  const gates = report.gates;
  const justified = report.paidLiveDataDecision.paidLiveDataTrialJustified;
  if (justified) {
    assert.equal(gates.sampleGate, true);
    assert.equal(gates.brierGate, true);
    assert.equal(gates.logLossGate, true);
    assert.equal(gates.brierBootstrapGate, true);
    assert.equal(gates.logLossBootstrapGate, true);
    assert.equal(gates.calibrationGate, true);
  }
});
