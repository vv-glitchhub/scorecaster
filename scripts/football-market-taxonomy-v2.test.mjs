import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FOOTBALL_MARKET_TAXONOMY_VERSION,
  buildFootballMarketCoverage,
  getFootballMarketReferenceTargets,
  getFootballReferenceGroupSummary
} from "../lib/football-market-taxonomy-v2.mjs";
import {
  getSafeMarketUniverseGroups,
  getSafeMarketUniverseRequestMarkets
} from "../lib/market-universe-sport-catalog.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

assert.equal(FOOTBALL_MARKET_TAXONOMY_VERSION, "scorecaster-football-market-taxonomy-v2");

const targets = getFootballMarketReferenceTargets();
assert(targets.length >= 30, "football reference taxonomy should cover the supplied bookmaker market map");
for (const key of [
  "match_result",
  "first_goal_team",
  "result_handicap",
  "match_totals",
  "team_totals",
  "both_teams_score",
  "double_chance",
  "draw_no_bet",
  "goalscorers",
  "halftime_fulltime",
  "first_half_result",
  "corners_totals",
  "most_corners",
  "cards_totals",
  "most_cards",
  "winner_total_25",
  "result_btts",
  "btts_total_25",
  "winning_margin",
  "special_combinations",
  "first_goal_10min",
  "first_goal_15min"
]) assert(targets.some((target) => target.key === key), `missing football reference target ${key}`);

const combinationSummary = getFootballReferenceGroupSummary("combinations");
assert(combinationSummary.targetCount >= 8);
assert(combinationSummary.providerGapTargetCount >= 8);

const goalsCoverage = buildFootballMarketCoverage("goals", ["btts", "alternate_totals"]);
assert.equal(goalsCoverage.version, FOOTBALL_MARKET_TAXONOMY_VERSION);
assert(goalsCoverage.targets.find((target) => target.key === "both_teams_score")?.status === "available");
assert(goalsCoverage.targets.find((target) => target.key === "team_totals")?.status === "not-offered");

const combinationCoverage = buildFootballMarketCoverage("combinations", []);
assert(combinationCoverage.targets.every((target) => target.status === "provider-gap"));

const soccerGroups = getSafeMarketUniverseGroups("soccer_epl");
const featured = soccerGroups.find((group) => group.key === "featured");
const periods = soccerGroups.find((group) => group.key === "periods");
assert(featured?.markets.includes("alternate_spreads"), "football featured group should include alternate handicap markets");
assert(periods?.markets.includes("h2h_3_way_h1"), "football periods should request documented 1st-half 1X2");
assert(periods?.markets.includes("totals_h1"), "football periods should request documented 1st-half totals");
assert(getSafeMarketUniverseRequestMarkets("soccer_epl", "players").includes("player_first_goal_scorer"));

const route = await source("app/api/market-universe/route.js");
assert.match(route, /buildFootballMarketCoverage/);
assert.match(route, /group === "players" \? "us" : "eu,uk"/);
assert.match(route, /offeredMarketKeys/);
assert.match(route, /marketCoverage:/);
assert.match(route, /h2h_3_way_h1/);
assert.match(route, /totals_h1/);
assert.match(route, /paperOnly: true/);
assert.match(route, /realMoneyBetting: false/);

const panel = await source("app/market-universe/FootballMarketReferencePanel.jsx");
assert.match(panel, /data-football-market-taxonomy/);
assert.match(panel, /Provider gap/);
assert.match(panel, /verified rights/);
assert.doesNotMatch(panel, /fetch\(|apiKey|authorization/i);

console.log("Football Market Taxonomy V2 regression: PASS");
