import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeFixedOddsSelection,
  analyzePoolPopularity,
  analyzeTulosvetoSelection,
  createVeikkausIntelligenceBoundary,
  mapVeikkausMarketLabel,
  rankVakioMarks,
} from "../lib/veikkaus-intelligence-v1.mjs";

test("maps observed Veikkaus football labels into canonical markets", () => {
  assert.equal(mapVeikkausMarketLabel("Voittaja (1X2)").canonicalMarket, "h2h_1x2");
  assert.equal(mapVeikkausMarketLabel("Maalit Yli/Alle").canonicalMarket, "totals");
  assert.equal(mapVeikkausMarketLabel("Tasoitus").canonicalMarket, "handicap");
  assert.equal(mapVeikkausMarketLabel("Tasapeli ei vetoa").canonicalMarket, "draw_no_bet");
  assert.equal(mapVeikkausMarketLabel("Puoliaika/lopputulos").canonicalMarket, "half_full_time");
  assert.equal(mapVeikkausMarketLabel("Lopputulos").canonicalMarket, "correct_score");
  assert.equal(mapVeikkausMarketLabel("Tuntematon erikoismarkkina").supported, false);
});

test("fixed-odds analysis keeps model, implied price and EV separate", () => {
  const result = analyzeFixedOddsSelection({ decimalOdds: 2.08, modelProbability: 0.52, benchmarkProbability: 0.50 });
  assert.equal(result.impliedProbability, 0.480769);
  assert.equal(result.fairOdds, 1.923077);
  assert.equal(result.edgeProbability, 0.039231);
  assert.equal(result.expectedValue, 0.0816);
  assert.equal(result.modelVsBenchmark, 0.02);
  assert.equal(result.valueState, "positive");
});

test("Vakio-style pool popularity does not invent EV without a return rate", () => {
  const result = analyzePoolPopularity({ modelProbability: 0.54, playedShare: 0.41 });
  assert.equal(result.difference, 0.13);
  assert.equal(result.valueRatio, 1.317073);
  assert.equal(result.popularityState, "underplayed");
  assert.equal(result.expectedValue, null);
  assert.equal(result.expectedValueReason, "pool_return_rate_not_supplied");
});

test("Tulosveto uses the documented 77 percent round return for pool EV", () => {
  const result = analyzeTulosvetoSelection({ modelProbability: 0.10, observedOdds: 10 });
  assert.equal(result.returnRate, 0.77);
  assert.equal(result.estimatedPlayedShare, 0.077);
  assert.equal(result.expectedValue, 0);
});

test("Vakio marks are ranked by model share relative to played share", () => {
  const rows = rankVakioMarks([
    { mark: "1", modelProbability: 0.54, playedShare: 0.41 },
    { mark: "X", modelProbability: 0.25, playedShare: 0.30 },
    { mark: "2", modelProbability: 0.21, playedShare: 0.29 },
  ]);
  assert.equal(rows[0].mark, "1");
  assert.equal(rows[0].popularityState, "underplayed");
  assert.equal(rows[2].mark, "2");
});

test("Veikkaus Intelligence is explicitly paper-only and disconnected", () => {
  assert.deepEqual(createVeikkausIntelligenceBoundary(), {
    version: "veikkaus-intelligence-v1.0",
    paperOnly: true,
    veikkausAccountConnection: false,
    betPlacement: false,
    cashOut: false,
    moneyMovement: false,
    liveDataScraping: false,
    externalSourceConnected: false,
    purpose: "read_only_analysis_and_manual_snapshot_comparison",
  });
});
