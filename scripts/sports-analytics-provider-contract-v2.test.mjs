import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSportsAnalyticsProviderRequest,
  SPORTS_ANALYTICS_NHL_XG_GOALIE_REQUESTED_METRICS,
  SPORTS_ANALYTICS_SOCCER_XG_REQUESTED_METRICS,
  SPORTS_ANALYTICS_BASKETBALL_EFFICIENCY_REQUESTED_METRICS
} from "../lib/sports-analytics-provider.js";

function nhlMatch() {
  return {
    eventId: "nhl-event-1",
    sportKey: "icehockey_nhl",
    sport: "NHL",
    league: "NHL",
    homeTeam: "Toronto Maple Leafs",
    awayTeam: "Boston Bruins",
    commenceTime: "2026-10-15T23:00:00.000Z"
  };
}

function soccerMatch() {
  return {
    eventId: "soccer-event-1",
    sportKey: "soccer_epl",
    sport: "Soccer",
    league: "EPL",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    commenceTime: "2026-10-15T18:00:00.000Z"
  };
}

function basketballMatch() {
  return {
    eventId: "nba-event-1",
    sportKey: "basketball_nba",
    sport: "NBA",
    league: "NBA",
    homeTeam: "Boston Celtics",
    awayTeam: "New York Knicks",
    commenceTime: "2026-10-15T23:30:00.000Z"
  };
}

test("sports analytics V4 requests all NHL xG goalie shadow metrics", () => {
  const request = buildSportsAnalyticsProviderRequest(nhlMatch());
  assert.equal(request.contract, "scorecaster-sports-analytics-v4");
  assert.equal(request.event.sport, "ice_hockey");
  for (const metric of SPORTS_ANALYTICS_NHL_XG_GOALIE_REQUESTED_METRICS) assert.ok(request.requestedMetrics.includes(metric), metric);
  assert.equal(request.policy.marketPricingCannotBeUsedAsIndependentModelInput, true);
  assert.equal(request.policy.paperOnly, true);
});

test("NHL provider request exposes a strict model input contract", () => {
  const request = buildSportsAnalyticsProviderRequest(nhlMatch());
  const contract = request.requestedModelContracts.find((item) => item.modelId === "nhl-xg-goalie-poisson-v1");
  assert.ok(contract);
  assert.deepEqual(contract.requiredMetrics, ["xg-for-per-60", "xg-against-per-60", "goals-saved-above-expected-per-60"]);
  assert.deepEqual(contract.optionalMetrics, ["post-shot-xg-for-per-60"]);
  assert.match(contract.participantContract.goalieMetric, /starter=true/);
  assert.equal(contract.independentFromMarketPricing, true);
  assert.equal(contract.units, "per-60");
});

test("soccer provider request exposes per-90 xG inputs without market pricing", () => {
  const request = buildSportsAnalyticsProviderRequest(soccerMatch());
  assert.equal(request.event.sport, "soccer");
  for (const metric of SPORTS_ANALYTICS_SOCCER_XG_REQUESTED_METRICS) assert.ok(request.requestedMetrics.includes(metric), metric);
  const contract = request.requestedModelContracts.find((item) => item.modelId === "soccer-xg-poisson-v1");
  assert.ok(contract);
  assert.deepEqual(contract.requiredMetrics, ["xg-for-per-90", "xg-against-per-90"]);
  assert.deepEqual(contract.optionalMetrics, ["post-shot-xg-for-per-90"]);
  assert.equal(contract.independentFromMarketPricing, true);
  assert.equal(contract.units, "per-90");
});

test("basketball provider request exposes pace and efficiency inputs without market pricing", () => {
  const request = buildSportsAnalyticsProviderRequest(basketballMatch());
  assert.equal(request.event.sport, "basketball");
  for (const metric of SPORTS_ANALYTICS_BASKETBALL_EFFICIENCY_REQUESTED_METRICS) assert.ok(request.requestedMetrics.includes(metric), metric);
  const contract = request.requestedModelContracts.find((item) => item.modelId === "basketball-efficiency-pace-v1");
  assert.ok(contract);
  assert.deepEqual(contract.requiredMetrics, ["pace", "offensive-rating", "defensive-rating"]);
  assert.deepEqual(contract.optionalMetrics, ["lineup-adjusted-impact"]);
  assert.deepEqual(contract.profiles, ["nba-efficiency-pace-v1", "wnba-efficiency-pace-v1"]);
  assert.equal(contract.independentFromMarketPricing, true);
  assert.match(contract.units, /points-per-100-possessions/);
});

test("sports without an advanced model contract do not receive one", () => {
  const request = buildSportsAnalyticsProviderRequest({
    eventId: "mlb-event-1",
    sportKey: "baseball_mlb",
    sport: "MLB",
    league: "MLB",
    homeTeam: "Home",
    awayTeam: "Away"
  });
  assert.equal(request.event.sport, "baseball");
  assert.equal(request.requestedModelContracts.length, 0);
});
