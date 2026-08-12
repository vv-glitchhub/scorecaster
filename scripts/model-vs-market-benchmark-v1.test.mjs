import test from "node:test";
import assert from "node:assert/strict";
import { buildNoVigEventMarketBenchmarkV1 } from "../lib/no-vig-market-benchmark-v1.mjs";
import { createScorecasterPick } from "../lib/scorecaster-engine.js";

const CAPTURED_AT = "2026-08-12T12:00:00.000Z";

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

function bookmaker(key, outcomes) {
  return {
    key,
    title: key,
    last_update: "2026-08-12T11:55:00.000Z",
    markets: [{ key: "h2h", last_update: "2026-08-12T11:55:00.000Z", outcomes }]
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

test("Scorecaster picks carry the complete event consensus without another provider call", () => {
  const game = {
    id: "nba-1",
    sport_key: "basketball_nba",
    sport_title: "NBA",
    commence_time: "2026-08-12T23:00:00.000Z",
    home_team: "Boston Celtics",
    away_team: "New York Knicks",
    bookmakers: [
      bookmaker("a", [{ name: "Boston Celtics", price: 1.8 }, { name: "New York Knicks", price: 2.1 }]),
      bookmaker("b", [{ name: "Boston Celtics", price: 1.85 }, { name: "New York Knicks", price: 2.05 }]),
      bookmaker("c", [{ name: "Boston Celtics", price: 1.82 }, { name: "New York Knicks", price: 2.08 }])
    ]
  };
  const picks = createScorecasterPick({ game, marketKey: "h2h" });
  assert.equal(picks.length, 2);
  assert.equal(picks.every((row) => row.eventConsensusDistribution.length === 2), true);
  assert.deepEqual(
    picks[0].eventConsensusDistribution.map((row) => row.selection).sort(),
    ["Boston Celtics", "New York Knicks"].sort()
  );
});
