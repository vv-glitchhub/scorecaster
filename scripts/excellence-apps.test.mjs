import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBettingGame, analyzeConsensusSelection } from "../lib/betting-excellence-engine.mjs";
import { buildAgentExcellenceDecision } from "../lib/agent-excellence-engine.mjs";
import { parseSimulatorFixtures } from "../lib/simulator-input-engine.mjs";
import { simulateMatch } from "../lib/simulator-engine.js";

function oddsGame() {
  return {
    id: "event-1",
    sport_key: "soccer_epl",
    sport_title: "Premier League",
    home_team: "Home FC",
    away_team: "Away FC",
    commence_time: "2026-08-01T15:00:00Z",
    bookmakers: [
      {
        key: "book-a",
        title: "Book A",
        last_update: "2026-07-16T06:00:00Z",
        markets: [{
          key: "h2h",
          last_update: "2026-07-16T06:00:00Z",
          outcomes: [
            { name: "Home FC", price: 2.2 },
            { name: "Draw", price: 3.4 },
            { name: "Away FC", price: 3.5 }
          ]
        }]
      },
      {
        key: "book-b",
        title: "Book B",
        last_update: "2026-07-16T06:00:00Z",
        markets: [{
          key: "h2h",
          outcomes: [
            { name: "Home FC", price: 2.15 },
            { name: "Draw", price: 3.5 },
            { name: "Away FC", price: 3.6 }
          ]
        }]
      },
      {
        key: "book-c",
        title: "Book C",
        last_update: "2026-07-16T06:00:00Z",
        markets: [{
          key: "h2h",
          outcomes: [
            { name: "Home FC", price: 2.18 },
            { name: "Draw", price: 3.45 },
            { name: "Away FC", price: 3.55 }
          ]
        }]
      },
      {
        key: "book-d",
        title: "Book D",
        last_update: "2026-07-16T06:00:00Z",
        markets: [{
          key: "h2h",
          outcomes: [
            { name: "Home FC", price: 2.4 },
            { name: "Draw", price: 3.3 },
            { name: "Away FC", price: 3.45 }
          ]
        }]
      }
    ]
  };
}

test("Betting uses no-vig consensus instead of a fixed probability", () => {
  const game = analyzeBettingGame(oddsGame(), "h2h", {
    bankroll: 1000,
    kellyMode: "quarter",
    maxStakePercent: 2,
    now: Date.parse("2026-07-16T06:10:00Z")
  });
  const home = game.selections.find((selection) => selection.selection === "Home FC");

  assert.ok(home);
  assert.notEqual(home.consensusProbability, 0.55);
  assert.equal(home.bookmakerCount, 4);
  assert.equal(home.modelMode, "market-consensus");
  assert.ok(home.suggestedStake <= 20);
  assert.equal(home.paperOnly, true);
});

test("Betting gates stale or non-positive selections to SKIP", () => {
  const stale = analyzeConsensusSelection({
    selection: "Example",
    odds: 2,
    consensusProbability: 0.5,
    confidence: 0.9,
    bookmakerCount: 8,
    freshnessLabel: "stale"
  });
  const negative = analyzeConsensusSelection({
    selection: "Example",
    odds: 1.8,
    consensusProbability: 0.5,
    confidence: 0.9,
    bookmakerCount: 8,
    freshnessLabel: "fresh"
  });

  assert.equal(stale.decision, "SKIP");
  assert.equal(negative.decision, "SKIP");
  assert.equal(stale.suggestedStake, 0);
});

test("Agent does not alter probability from a small learning sample", () => {
  const pick = {
    productDecision: "PLAY",
    sportKey: "soccer_epl",
    marketKey: "h2h",
    consensusProbability: 0.56,
    odds: 2,
    edge: 0.06,
    ev: 0.12,
    confidence: 0.8,
    trustScore: 80,
    bookmakerCount: 6,
    freshnessLabel: "fresh"
  };
  const decision = buildAgentExcellenceDecision({
    pick,
    learning: { bySport: { soccer_epl: { bets: 3, profit: 100, winRate: 1 } } }
  });

  assert.equal(decision.consensusProbability, 0.56);
  assert.equal(decision.probabilityAdjustedByLearning, false);
  assert.equal(decision.learningSignal.status, "insufficient");
  assert.equal(decision.decision, "PLAY");
});

test("Agent can downgrade priority after a sufficient weak paper sample", () => {
  const decision = buildAgentExcellenceDecision({
    pick: {
      productDecision: "PLAY",
      sportKey: "soccer_epl",
      marketKey: "h2h",
      consensusProbability: 0.56,
      odds: 2,
      edge: 0.06,
      ev: 0.12,
      confidence: 0.8,
      trustScore: 80,
      bookmakerCount: 6,
      freshnessLabel: "fresh"
    },
    learning: {
      bySport: { soccer_epl: { bets: 25, profit: -40, winRate: 0.4 } },
      byMarket: { h2h: { bets: 25, profit: -20, winRate: 0.44 } }
    }
  });

  assert.equal(decision.learningSignal.status, "downgrade");
  assert.equal(decision.decision, "WATCH");
  assert.equal(decision.suggestedStake, 0);
});

test("Simulator parser reports invalid rows and bounds numeric inputs", () => {
  const parsed = parseSimulatorFixtures([
    "Finland,Sweden,200,58,1,0,0,0,0,0,3",
    "Same,Same,55,55"
  ].join("\n"));

  assert.equal(parsed.fixtures.length, 1);
  assert.equal(parsed.fixtures[0].homeBaseRating, 100);
  assert.equal(parsed.warnings.length, 1);
  assert.equal(parsed.errors.length, 1);
});

test("Seeded simulator is reproducible and probabilities are normalized", () => {
  const input = {
    homeTeam: "Finland",
    awayTeam: "Sweden",
    homeRating: 58,
    awayRating: 57,
    homeAdvantage: 3,
    simulations: 20000,
    seed: "repeatable-test"
  };
  const first = simulateMatch(input);
  const second = simulateMatch(input);
  const total = first.homeWinProbability + first.drawProbability + first.awayWinProbability;

  assert.deepEqual(first, second);
  assert.ok(Math.abs(total - 1) < 1e-12);
  assert.equal(first.reproducible, true);
  assert.ok(first.homeWinInterval.low <= first.homeWinProbability);
  assert.ok(first.homeWinInterval.high >= first.homeWinProbability);
});
