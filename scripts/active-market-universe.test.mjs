import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MARKET_FAMILIES,
  OWNED_FOOTBALL_LEAGUES,
  activeMarketLeagues,
  marketSeason,
  topPicksDefaultLeagues,
} from "../lib/active-market-universe.js";

const file = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared market universe keeps Sep and Oct in transition", () => {
  assert.equal(marketSeason(Date.parse("2026-09-08T12:00:00Z")), "transition");
  assert.equal(marketSeason(Date.parse("2026-10-08T12:00:00Z")), "transition");
  assert.equal(marketSeason(Date.parse("2026-07-08T12:00:00Z")), "summer");
  assert.equal(marketSeason(Date.parse("2026-12-08T12:00:00Z")), "core-season");
});

test("transition Top Picks always represents every owned football league", () => {
  const now = Date.parse("2026-09-08T12:00:00Z");
  const active = activeMarketLeagues(now);
  const topPicks = topPicksDefaultLeagues(now, 12);
  for (const league of OWNED_FOOTBALL_LEAGUES) {
    assert.ok(active.includes(league), `${league} missing from active transition universe`);
    assert.ok(topPicks.includes(league), `${league} missing from bounded Top Picks universe`);
  }
  assert.ok(topPicks.length <= 12);
  assert.deepEqual(MARKET_FAMILIES, ["h2h", "spreads", "totals"]);
});

test("Top Picks, collector, recommendations and market worker consume the shared universe", async () => {
  const [topPicks, collector, recommendations, marketWorker] = await Promise.all([
    file("app/api/top-picks/route.js"),
    file("app/api/internal/collector/route.js"),
    file("app/api/recommendations/route.js"),
    file("app/api/internal/market-microstructure/route.js"),
  ]);

  assert.match(topPicks, /topPicksDefaultLeagues/);
  assert.match(topPicks, /marketSeason/);
  assert.doesNotMatch(topPicks, /CORE_SEASON_DEFAULT_LEAGUES|TRANSITION_DEFAULT_LEAGUES/);

  assert.match(collector, /activeMarketLeagues/);
  assert.doesNotMatch(collector, /FALLBACK_LEAGUES\s*=\s*\[/);

  assert.match(recommendations, /activeMarketLeagues/);
  assert.doesNotMatch(recommendations, /FALLBACK_ACTIVE_SPORTS\s*=\s*\[/);

  assert.match(marketWorker, /activeMarketLeagues/);
  assert.match(marketWorker, /MARKET_FAMILIES/);
  assert.doesNotMatch(marketWorker, /CORE_DEFAULTS\s*=\s*\[|SUMMER_DEFAULTS\s*=\s*\[/);
});

test("market capture stores only lightweight fixture snapshots beside market observations", async () => {
  const worker = await file("app/api/internal/market-microstructure/route.js");
  assert.match(worker, /fixtureSnapshotInputs/);
  assert.match(worker, /capturedAlongsideMarketMicrostructure:\s*true/);
  assert.match(worker, /sourceId:\s*"the_odds_api"/);
  assert.match(worker, /rawPayloadStored:\s*false/);
  assert.match(worker, /probabilityChanged:\s*false/);
  assert.match(worker, /realMoneyExecution:\s*false/);
});

test("public health advertises the current bounded decision pipeline instead of stale constants", async () => {
  const health = await file("app/api/health/route.js");
  assert.match(health, /activeMarketUniverse/);
  assert.match(health, /sportsIntelligenceMaxEnrichmentsPerTopPicksRequest:\s*24/);
  assert.match(health, /recommendationDecisionSurface:\s*true/);
  assert.match(health, /recommendationNoForcedPlay:\s*true/);
  assert.match(health, /intelligenceCoreVerifiedOutcomeLearning:\s*true/);
  assert.match(health, /intelligenceCoreAutomaticModelPromotionAllowed:\s*false/);
  assert.match(health, /realMoneyBetting:\s*false/);
});
