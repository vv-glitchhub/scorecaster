import test from "node:test";
import assert from "node:assert/strict";
import { determineDecision } from "../lib/agent-decision-engine.js";
import {
  calculateDataConfidence,
  estimateConsensusProbability,
  freshnessFromTimestamp,
  getConsensusPrices
} from "../lib/market-consensus-engine.mjs";

const NOW = Date.parse("2026-07-16T08:00:00.000Z");

function bookmaker(key, homeOdds, awayOdds, updated = "2026-07-16T07:50:00.000Z") {
  return {
    key,
    title: key.toUpperCase(),
    last_update: updated,
    markets: [{
      key: "h2h",
      last_update: updated,
      outcomes: [
        { name: "Home", price: homeOdds },
        { name: "Away", price: awayOdds }
      ]
    }]
  };
}

test("consensus removes each bookmaker margin and finds the best available price", () => {
  const prices = getConsensusPrices({
    bookmakers: [
      bookmaker("book-a", 1.9, 1.95),
      bookmaker("book-b", 2.05, 1.85),
      bookmaker("book-c", 2.0, 1.9)
    ]
  }, "h2h", NOW);

  const home = prices.find((item) => item.selection === "Home");
  const away = prices.find((item) => item.selection === "Away");

  assert.ok(home);
  assert.ok(away);
  assert.equal(home.bestOdds, 2.05);
  assert.equal(home.bookmakerKey, "book-b");
  assert.equal(home.bookmakerCount, 3);
  assert.equal(away.bookmakerCount, 3);
  assert.ok(Math.abs((home.consensusProbability + away.consensusProbability) - 1) < 0.02);
  assert.ok(home.averageOverround > 0);
});

test("fallback probability never adds a hidden home or away boost", () => {
  assert.equal(estimateConsensusProbability({ odds: 2 }), 0.5);
  assert.equal(estimateConsensusProbability({ odds: 4 }), 0.25);
  assert.equal(
    estimateConsensusProbability({ odds: 2, consensusProbability: 0.47 }),
    0.47
  );
});

test("confidence improves with broader, fresher and more consistent data", () => {
  const weak = calculateDataConfidence({
    bookmakerCount: 2,
    dispersion: 0.07,
    freshnessScore: 0.2
  });
  const strong = calculateDataConfidence({
    bookmakerCount: 8,
    dispersion: 0.005,
    freshnessScore: 1
  });

  assert.ok(strong > weak);
  assert.ok(strong <= 0.95);
  assert.ok(weak >= 0.05);
});

test("freshness labels are deterministic and stale data is visible", () => {
  assert.equal(freshnessFromTimestamp(NOW - (10 * 60 * 1000), NOW).label, "fresh");
  assert.equal(freshnessFromTimestamp(NOW - (2 * 60 * 60 * 1000), NOW).label, "recent");
  assert.equal(freshnessFromTimestamp(NOW - (8 * 60 * 60 * 1000), NOW).label, "aging");
  assert.equal(freshnessFromTimestamp(NOW - (24 * 60 * 60 * 1000), NOW).label, "stale");
});

test("invalid or one-sided markets are excluded instead of inventing probabilities", () => {
  const prices = getConsensusPrices({
    bookmakers: [{
      key: "broken",
      markets: [{ key: "h2h", outcomes: [{ name: "Home", price: 2.1 }] }]
    }]
  }, "h2h", NOW);

  assert.deepEqual(prices, []);
});

test("agent decisions accept numeric confidence from the consensus engine", () => {
  const decision = determineDecision({
    edge: 0.09,
    ev: 0.08,
    confidence: 0.78,
    sourceTrust: 0.8,
    riskLevel: "Low"
  });

  assert.equal(decision.decision, "BET");
});

test("legacy confidence labels remain compatible", () => {
  const decision = determineDecision({
    edge: 0.06,
    ev: 0.04,
    confidence: "Medium-high",
    sourceTrust: 0.6,
    riskLevel: "Medium"
  });

  assert.equal(decision.decision, "WATCH");
});
