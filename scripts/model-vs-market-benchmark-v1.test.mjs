import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildNoVigEventMarketBenchmarkV1 } from "../lib/no-vig-market-benchmark-v1.mjs";

const CAPTURED_AT = "2026-08-12T12:00:00.000Z";
const scorecasterEngineSource = fs.readFileSync(new URL("../lib/scorecaster-engine.js", import.meta.url), "utf8");
const sportsAnalyticsWorkerSource = fs.readFileSync(new URL("../app/api/internal/sports-analytics/route.js", import.meta.url), "utf8");

function pick(overrides = {}) {
  return {
    sportKey: "basketball_nba",
    homeTeam: "Boston Celtics",
    awayTeam: "New York Knicks",
    marketKey: "h2h",
    eventConsensusDistribution: [
      { selection: "Boston Celtics", probability: 0.58, bookmakerCount: 8 },
      { selection: "New York Knicks", probability: 0.42, bookmakerCount: 8 }
    ],
    ...overrides
  };
}

test("binary benchmark preserves the full no-vig home-away event distribution", () => {
  const benchmark = buildNoVigEventMarketBenchmarkV1(pick(), { capturedAt: CAPTURED_AT });
  assert.ok(benchmark);
  assert.deepEqual(benchmark.probabilities, { home: 0.58, away: 0.42 });
  assert.equal(benchmark.independentPredictiveModel, false);
  assert.equal(benchmark.productionProbabilityChanged, false);
});

test("soccer benchmark requires and preserves the draw outcome", () => {
  const benchmark = buildNoVigEventMarketBenchmarkV1(pick({
    sportKey: "soccer_epl",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    eventConsensusDistribution: [
      { selection: "Arsenal", probability: 0.48 },
      { selection: "Draw", probability: 0.27 },
      { selection: "Chelsea", probability: 0.25 }
    ]
  }), { capturedAt: CAPTURED_AT });
  assert.ok(benchmark);
  assert.deepEqual(benchmark.probabilities, { home: 0.48, draw: 0.27, away: 0.25 });
});

test("incomplete soccer distribution fails closed instead of inventing draw probability", () => {
  const benchmark = buildNoVigEventMarketBenchmarkV1(pick({
    sportKey: "soccer_epl",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    eventConsensusDistribution: [
      { selection: "Arsenal", probability: 0.6 },
      { selection: "Chelsea", probability: 0.4 }
    ]
  }), { capturedAt: CAPTURED_AT });
  assert.equal(benchmark, null);
});

test("small consensus rounding drift is explicitly renormalized and audited", () => {
  const benchmark = buildNoVigEventMarketBenchmarkV1(pick({
    eventConsensusDistribution: [
      { selection: "Boston Celtics", probability: 0.581 },
      { selection: "New York Knicks", probability: 0.421 }
    ]
  }), { capturedAt: CAPTURED_AT });
  assert.ok(benchmark);
  assert.equal(benchmark.renormalized, true);
  assert.equal(benchmark.rawProbabilityTotal, 1.002);
  assert.ok(Math.abs(benchmark.probabilities.home + benchmark.probabilities.away - 1) < 1e-7);
});

test("materially invalid probability totals are rejected", () => {
  const benchmark = buildNoVigEventMarketBenchmarkV1(pick({
    eventConsensusDistribution: [
      { selection: "Boston Celtics", probability: 0.8 },
      { selection: "New York Knicks", probability: 0.5 }
    ]
  }), { capturedAt: CAPTURED_AT });
  assert.equal(benchmark, null);
});

test("Scorecaster engine carries the complete event consensus without another provider call", () => {
  assert.match(scorecasterEngineSource, /const eventConsensusDistribution = fullEventConsensus\(consensusPrices\)/);
  assert.match(scorecasterEngineSource, /eventConsensusDistribution,/);
  assert.equal(scorecasterEngineSource.includes("fetch("), false);
});

test("protected Sports Analytics worker uses the tested benchmark builder", () => {
  assert.match(sportsAnalyticsWorkerSource, /buildNoVigEventMarketBenchmarkV1/);
  assert.match(sportsAnalyticsWorkerSource, /marketBenchmarkCapturedBeforeStart/);
  assert.match(sportsAnalyticsWorkerSource, /advanced-shadow-prediction-ledger-v2/);
});
