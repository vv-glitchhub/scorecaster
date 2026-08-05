import test from "node:test";
import assert from "node:assert/strict";
import { determineDecision } from "../lib/agent-decision-engine.js";
import {
  calculateDataConfidence,
  estimateConsensusProbability,
  freshnessFromTimestamp,
  getBookmakerCatalog,
  getConsensusPrices
} from "../lib/market-consensus-engine.mjs";
import {
  BOOKMAKER_ALL,
  analyzeBettingGames,
  rankBettingSelections
} from "../lib/betting-excellence-engine.mjs";

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

function game(id, books, commenceTime = "2026-07-16T18:00:00.000Z") {
  return {
    id,
    sport_key: "soccer_finland_veikkausliiga",
    sport_title: "Veikkausliiga",
    home_team: "Home",
    away_team: "Away",
    commence_time: commenceTime,
    bookmakers: books
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
  assert.equal(home.offers.length, 3);
  assert.equal(home.offers[0].bookmakerKey, "book-b");
});

test("bookmaker catalog lists only providers with complete requested markets", () => {
  const catalog = getBookmakerCatalog([
    game("one", [
      bookmaker("book-b", 2.05, 1.85),
      bookmaker("book-a", 1.9, 1.95),
      { key: "broken", title: "Broken", markets: [{ key: "h2h", outcomes: [{ name: "Home", price: 2.2 }] }] }
    ]),
    game("two", [bookmaker("book-a", 2.1, 1.8)])
  ]);

  assert.deepEqual(catalog.map((item) => item.key), ["book-a", "book-b"]);
  assert.equal(catalog.find((item) => item.key === "book-a")?.eventCount, 2);
  assert.equal(catalog.find((item) => item.key === "book-b")?.eventCount, 1);
});

test("specific bookmaker mode changes price and EV but keeps whole-market consensus", () => {
  const sourceGame = game("provider-test", [
    bookmaker("book-a", 1.9, 2.0),
    bookmaker("book-b", 2.2, 1.75),
    bookmaker("book-c", 2.05, 1.85),
    bookmaker("book-d", 2.0, 1.9)
  ]);

  const best = analyzeBettingGames([sourceGame], "h2h", {
    now: NOW,
    bookmakerKey: BOOKMAKER_ALL,
    bankroll: 1000,
    kellyMode: "quarter",
    maxStakePercent: 2
  })[0].selections.find((item) => item.selection === "Home");

  const selected = analyzeBettingGames([sourceGame], "h2h", {
    now: NOW,
    bookmakerKey: "book-a",
    bankroll: 1000,
    kellyMode: "quarter",
    maxStakePercent: 2
  })[0].selections.find((item) => item.selection === "Home");

  assert.ok(best);
  assert.ok(selected);
  assert.equal(best.odds, 2.2);
  assert.equal(best.bookmakerKey, "book-b");
  assert.equal(selected.odds, 1.9);
  assert.equal(selected.bookmakerKey, "book-a");
  assert.equal(selected.bestMarketOdds, 2.2);
  assert.equal(selected.bestMarketBookmakerKey, "book-b");
  assert.equal(selected.consensusProbability, best.consensusProbability);
  assert.ok(selected.ev < best.ev);
  assert.ok(selected.priceGapToBest > 0);
  assert.equal(selected.isBestMarketPrice, false);
});

test("specific bookmaker mode excludes games where that provider lacks a complete market", () => {
  const sourceGame = game("missing-provider", [
    bookmaker("book-a", 1.9, 2.0),
    bookmaker("book-b", 2.2, 1.75)
  ]);

  assert.deepEqual(analyzeBettingGames([sourceGame], "h2h", { bookmakerKey: "unknown", now: NOW }), []);
});

test("ranked selections prioritize decision class and requested professional metric", () => {
  const games = analyzeBettingGames([
    game("one", [
      bookmaker("book-a", 2.2, 1.75),
      bookmaker("book-b", 2.15, 1.8),
      bookmaker("book-c", 2.1, 1.85),
      bookmaker("book-d", 2.05, 1.9)
    ]),
    game("two", [
      bookmaker("book-a", 1.7, 2.4),
      bookmaker("book-b", 1.75, 2.3),
      bookmaker("book-c", 1.8, 2.2),
      bookmaker("book-d", 1.85, 2.1)
    ], "2026-07-16T20:00:00.000Z")
  ], "h2h", { bookmakerKey: BOOKMAKER_ALL, now: NOW });

  const ranked = rankBettingSelections(games, "ev");
  assert.ok(ranked.length >= 4);
  assert.ok(["PLAY", "CAUTION", "SKIP"].includes(ranked[0].selection.decision));
  for (let index = 1; index < ranked.length; index += 1) {
    const order = { PLAY: 3, CAUTION: 2, SKIP: 1 };
    assert.ok(order[ranked[index - 1].selection.decision] >= order[ranked[index].selection.decision]);
  }
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
