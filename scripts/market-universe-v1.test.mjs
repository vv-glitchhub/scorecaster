import assert from "node:assert/strict";
import { buildMarketUniverse } from "../lib/market-universe-v1.mjs";
import {
  getSafeMarketUniverseGroups,
  getSafeMarketUniverseRequestMarkets
} from "../lib/market-universe-sport-catalog.mjs";

const NOW = Date.parse("2026-08-20T09:00:00Z");

function bookmaker(key, over, under, point = 0.5) {
  return {
    key,
    title: key.toUpperCase(),
    last_update: "2026-08-20T08:55:00Z",
    markets: [
      {
        key: "team_totals",
        last_update: "2026-08-20T08:55:00Z",
        outcomes: [
          { name: "Over", description: "Arsenal", point, price: over },
          { name: "Under", description: "Arsenal", point, price: under }
        ]
      },
      {
        key: "double_chance",
        last_update: "2026-08-20T08:55:00Z",
        outcomes: [
          { name: "Home or Draw", price: 1.30 },
          { name: "Away or Draw", price: 1.55 },
          { name: "Home or Away", price: 1.25 }
        ]
      }
    ]
  };
}

const soccerGroups = getSafeMarketUniverseGroups("soccer_epl").map((item) => item.key);
assert(soccerGroups.includes("goals"));
assert(soccerGroups.includes("corners_cards"));
assert(soccerGroups.includes("players"));
assert(getSafeMarketUniverseRequestMarkets("soccer_epl", "goals").includes("team_totals"));
assert(getSafeMarketUniverseRequestMarkets("soccer_epl", "goals").includes("btts"));

const basketballGroups = getSafeMarketUniverseGroups("basketball_nba").map((item) => item.key);
assert(!basketballGroups.includes("corners_cards"));
assert(!basketballGroups.includes("goals"));
assert(basketballGroups.includes("players"));
assert.deepEqual(getSafeMarketUniverseRequestMarkets("basketball_nba", "result"), []);

const event = {
  id: "evt-market-universe",
  sport_key: "soccer_epl",
  sport_title: "EPL",
  commence_time: "2026-08-20T18:00:00Z",
  home_team: "Arsenal",
  away_team: "Chelsea",
  bookmakers: [
    bookmaker("book1", 2.20, 1.68),
    bookmaker("book2", 1.94, 1.90),
    bookmaker("book3", 1.92, 1.92),
    bookmaker("book4", 1.90, 1.94)
  ]
};

const teamGoalUniverse = buildMarketUniverse(event, {
  requestedMarkets: ["team_totals"],
  bankroll: 1000,
  maxStakePercent: 1,
  kellyMode: "quarter",
  now: NOW
});

assert.equal(teamGoalUniverse.paperOnly, true);
assert.equal(teamGoalUniverse.probabilityChangedByMarketType, false);
assert.equal(teamGoalUniverse.marketCount, 1);
const teamTotals = teamGoalUniverse.markets[0];
assert.equal(teamTotals.key, "team_totals");
const halfGoalUnit = teamTotals.units.find((unit) => unit.point === 0.5);
assert(halfGoalUnit, "team total 0.5 unit should exist");
assert.equal(halfGoalUnit.analysisEligible, true, "half-goal line has no push and can use two-way no-vig");
const overGoal = halfGoalUnit.selections.find((selection) => selection.selection.includes("Over"));
assert(overGoal, "Over 0.5 selection should exist");
assert.equal(overGoal.analysisEligible, true);
assert.equal(overGoal.bookmakerCount, 4);
assert(Number.isFinite(overGoal.consensusProbability));
assert(Number.isFinite(overGoal.edge));
assert(Number.isFinite(overGoal.ev));
assert(["PLAY", "CAUTION", "SKIP"].includes(overGoal.decision));
assert.equal(overGoal.paperOnly, true);

const pushEvent = {
  ...event,
  bookmakers: [
    bookmaker("book1", 2.10, 1.75, 1),
    bookmaker("book2", 2.00, 1.82, 1),
    bookmaker("book3", 1.98, 1.84, 1),
    bookmaker("book4", 1.96, 1.86, 1)
  ]
};
const pushUniverse = buildMarketUniverse(pushEvent, {
  requestedMarkets: ["team_totals"],
  now: NOW
});
const pushUnit = pushUniverse.markets[0].units.find((unit) => unit.point === 1);
assert(pushUnit);
assert.equal(pushUnit.analysisEligible, false, "integer team total can push and must not use simple EV");
assert(pushUnit.selections.every((selection) => selection.decision === "PRICE_ONLY"));
assert(pushUnit.selections.every((selection) => selection.consensusProbability === null));

const doubleChanceUniverse = buildMarketUniverse(event, {
  requestedMarkets: ["double_chance"],
  now: NOW
});
assert.equal(doubleChanceUniverse.markets[0].units[0].analysisEligible, false);
assert(doubleChanceUniverse.markets[0].units[0].selections.every((selection) => selection.decision === "PRICE_ONLY"));

console.log("Market Universe V1 regression: PASS");
