import test from "node:test";
import assert from "node:assert/strict";
import {
  FOOTBALL_ML_CHALLENGER_VERSION,
  FOOTBALL_ML_FEATURES,
  buildFootballMlFeatureDataset,
  predictFootballMlChallenger,
  runFootballMlChallengerLab
} from "../lib/football-ml-challenger-v1.mjs";

function syntheticRows(count = 240) {
  const teams = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const homeIndex = index % teams.length;
    const awayIndex = (index * 5 + 3) % teams.length;
    const homeStrength = 0.8 + homeIndex * 0.16;
    const awayStrength = 0.7 + awayIndex * 0.13;
    const homeXg = 0.55 + homeStrength * 0.95;
    const awayXg = 0.45 + awayStrength * 0.78;
    const homeShots = Math.max(5, Math.round(8 + homeStrength * 5));
    const awayShots = Math.max(5, Math.round(7 + awayStrength * 5));
    const margin = homeStrength - awayStrength + 0.18;
    const homeGoals = margin > 0.22 ? 2 : margin < -0.18 ? 0 : 1;
    const awayGoals = margin < -0.18 ? 2 : margin > 0.22 ? 0 : 1;
    const date = new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10);
    const marketHome = Math.min(0.68, Math.max(0.18, 0.39 + margin * 0.12));
    const marketAway = Math.min(0.57, Math.max(0.15, 0.30 - margin * 0.10));
    const marketDraw = Math.max(0.12, 1 - marketHome - marketAway);
    const total = marketHome + marketDraw + marketAway;
    rows.push({
      matchId: 10_000 + index,
      date,
      homeTeam: teams[homeIndex],
      awayTeam: teams[awayIndex],
      homeXg,
      awayXg,
      homeShots,
      awayShots,
      shots: homeShots + awayShots,
      homeGoals,
      awayGoals,
      marketOdds: {
        home: 1 / (marketHome / total),
        draw: 1 / (marketDraw / total),
        away: 1 / (marketAway / total),
        source: "synthetic-market",
        timing: "pregame"
      }
    });
  }
  return rows;
}

test("feature dataset is pregame chronology-safe and does not use current-match outcome inputs", () => {
  const rows = syntheticRows(40);
  const baseline = buildFootballMlFeatureDataset(rows);
  const changed = structuredClone(rows);
  changed[20].homeXg = 8;
  changed[20].awayXg = 0.01;
  changed[20].homeGoals = 9;
  changed[20].awayGoals = 0;
  changed[20].homeShots = 50;
  changed[20].awayShots = 1;
  const altered = buildFootballMlFeatureDataset(changed);

  assert.equal(baseline[20].chronology.currentMatchInputsUsed, false);
  assert.deepEqual(altered[20].features, baseline[20].features);
  assert.equal(altered[20].date, baseline[20].date);
  assert.equal(FOOTBALL_ML_FEATURES.includes("poisson_home"), true);
  assert.equal(FOOTBALL_ML_FEATURES.some((name) => name.includes("market")), false);
});

test("ML lab uses chronological train/validation/holdout and serializable predictions", () => {
  const report = runFootballMlChallengerLab(syntheticRows(240), {
    maxRounds: 30,
    earlyStoppingRounds: 6,
    minLeaf: 8,
    bootstrapSamples: 120,
    bootstrapSeed: 42
  });

  assert.equal(report.ok, true);
  assert.equal(report.version, FOOTBALL_ML_CHALLENGER_VERSION);
  assert.equal(report.split.total, 240);
  assert.equal(report.split.chronologySafe, true);
  assert.ok(report.split.trainThrough < report.split.validationThrough);
  assert.ok(report.split.validationThrough < report.split.holdoutFrom);
  assert.equal(report.split.holdout >= 70, true);
  assert.equal(report.model.safety.marketFeaturesUsedByIndependentMl, false);
  assert.equal(report.safety.productionProbabilityChanged, false);
  assert.equal(report.safety.productionPlayUpgradeAllowed, false);
  assert.equal(report.safety.paperOnly, true);

  const dataset = buildFootballMlFeatureDataset(syntheticRows(240));
  const probability = predictFootballMlChallenger(report.model, dataset.at(-1).features);
  const total = probability.home + probability.draw + probability.away;
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.ok(probability.home > 0 && probability.home < 1);
  assert.ok(probability.draw > 0 && probability.draw < 1);
  assert.ok(probability.away > 0 && probability.away < 1);
  assert.doesNotThrow(() => JSON.stringify(report.model));
});

test("promotion gate can never auto-promote and always requires statistical gates", () => {
  const report = runFootballMlChallengerLab(syntheticRows(360), {
    maxRounds: 35,
    earlyStoppingRounds: 6,
    minLeaf: 8,
    bootstrapSamples: 150,
    bootstrapSeed: 7
  });

  assert.equal(report.ok, true);
  assert.equal(report.split.holdout >= 100, true);
  assert.equal(report.comparisons.mlVsMarket.gate.autoPromotionAllowed, false);
  assert.equal(report.comparisons.ensembleVsMarket.gate.autoPromotionAllowed, false);
  assert.equal(report.champion.automaticPromotionAllowed, false);
  assert.equal(report.safety.realMoneyActionAvailable, false);

  for (const comparison of [report.comparisons.mlVsMarket, report.comparisons.ensembleVsMarket]) {
    const keys = Object.keys(comparison.gate.passes).sort();
    assert.deepEqual(keys, ["brier", "brierCi", "calibration", "logLoss", "logLossCi", "sample"]);
  }
});

test("market is benchmark-only for independent ML while ensemble use is explicit", () => {
  const report = runFootballMlChallengerLab(syntheticRows(240), {
    maxRounds: 20,
    earlyStoppingRounds: 5,
    minLeaf: 8,
    bootstrapSamples: 80
  });
  assert.equal(report.safety.marketFeatureUsedByIndependentMl, false);
  assert.equal(report.safety.ensembleUsesMarketBenchmark, true);
  assert.equal(report.model.featureNames.some((name) => name.includes("market")), false);
  assert.equal(report.ensembleWeights.market + report.ensembleWeights.ml + report.ensembleWeights.poisson, 1);
});
