import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSportsAnalyticsProviderRequest,
  SPORTS_ANALYTICS_NHL_XG_GOALIE_REQUESTED_METRICS,
  SPORTS_ANALYTICS_SOCCER_XG_REQUESTED_METRICS,
  SPORTS_ANALYTICS_BASKETBALL_EFFICIENCY_REQUESTED_METRICS,
  SPORTS_ANALYTICS_MLB_PITCHING_OFFENSE_REQUESTED_METRICS
} from "../lib/sports-analytics-provider.js";

const match = (overrides = {}) => ({
  eventId: "event-1",
  sportKey: "icehockey_nhl",
  sport: "NHL",
  league: "NHL",
  homeTeam: "Home",
  awayTeam: "Away",
  commenceTime: "2026-10-15T23:00:00.000Z",
  ...overrides
});

function nhlMatch() { return match(); }
function soccerMatch() { return match({ sportKey: "soccer_epl", sport: "Soccer", league: "EPL" }); }
function basketballMatch() { return match({ sportKey: "basketball_nba", sport: "NBA", league: "NBA" }); }
function mlbMatch() { return match({ sportKey: "baseball_mlb", sport: "MLB", league: "MLB" }); }

test("sports analytics V5 requests all NHL xG goalie shadow metrics", () => {
  const request = buildSportsAnalyticsProviderRequest(nhlMatch());
  assert.equal(request.contract, "scorecaster-sports-analytics-v5");
  assert.equal(request.event.sport, "ice_hockey");
  for (const metric of SPORTS_ANALYTICS_NHL_XG_GOALIE_REQUESTED_METRICS) assert.ok(request.requestedMetrics.includes(metric), metric);
  assert.equal(request.policy.marketPricingCannotBeUsedAsIndependentModelInput, true);
  assert.equal(request.policy.paperOnly, true);
});

test("NHL provider request exposes a strict model input contract", () => {
  const contract = buildSportsAnalyticsProviderRequest(nhlMatch()).requestedModelContracts.find((item) => item.modelId === "nhl-xg-goalie-poisson-v1");
  assert.ok(contract);
  assert.deepEqual(contract.requiredMetrics, ["xg-for-per-60", "xg-against-per-60", "goals-saved-above-expected-per-60"]);
  assert.deepEqual(contract.optionalMetrics, ["post-shot-xg-for-per-60"]);
  assert.match(contract.participantContract.goalieMetric, /starter=true/);
  assert.equal(contract.independentFromMarketPricing, true);
});

test("soccer provider request exposes per-90 xG inputs without market pricing", () => {
  const request = buildSportsAnalyticsProviderRequest(soccerMatch());
  assert.equal(request.event.sport, "soccer");
  for (const metric of SPORTS_ANALYTICS_SOCCER_XG_REQUESTED_METRICS) assert.ok(request.requestedMetrics.includes(metric), metric);
  const contract = request.requestedModelContracts.find((item) => item.modelId === "soccer-xg-poisson-v1");
  assert.deepEqual(contract.requiredMetrics, ["xg-for-per-90", "xg-against-per-90"]);
  assert.deepEqual(contract.optionalMetrics, ["post-shot-xg-for-per-90"]);
  assert.equal(contract.independentFromMarketPricing, true);
});

test("basketball provider request exposes pace and efficiency inputs without market pricing", () => {
  const request = buildSportsAnalyticsProviderRequest(basketballMatch());
  assert.equal(request.event.sport, "basketball");
  for (const metric of SPORTS_ANALYTICS_BASKETBALL_EFFICIENCY_REQUESTED_METRICS) assert.ok(request.requestedMetrics.includes(metric), metric);
  const contract = request.requestedModelContracts.find((item) => item.modelId === "basketball-efficiency-pace-v1");
  assert.deepEqual(contract.requiredMetrics, ["pace", "offensive-rating", "defensive-rating"]);
  assert.deepEqual(contract.optionalMetrics, ["lineup-adjusted-impact"]);
  assert.deepEqual(contract.profiles, ["nba-efficiency-pace-v1", "wnba-efficiency-pace-v1"]);
  assert.equal(contract.independentFromMarketPricing, true);
});

test("MLB provider request requires standardized team strengths and confirmed starter xwOBA allowed", () => {
  const request = buildSportsAnalyticsProviderRequest(mlbMatch());
  assert.equal(request.event.sport, "baseball");
  for (const metric of SPORTS_ANALYTICS_MLB_PITCHING_OFFENSE_REQUESTED_METRICS) assert.ok(request.requestedMetrics.includes(metric), metric);
  const contract = request.requestedModelContracts.find((item) => item.modelId === "mlb-pitching-offense-v1");
  assert.ok(contract);
  assert.deepEqual(contract.requiredMetrics, ["lineup-strength", "bullpen-depth", "starting-pitcher-xwoba-allowed"]);
  assert.deepEqual(contract.optionalMetrics, ["park-adjusted-strength"]);
  assert.match(contract.participantContract.teamMetrics, /standardized z-scores/);
  assert.match(contract.participantContract.startingPitcherMetric, /starter=true/);
  assert.match(contract.participantContract.startingPitcherMetric, /perspective=allowed\/against/);
  assert.equal(contract.independentFromMarketPricing, true);
  assert.match(contract.units, /xwOBA allowed/);
});

test("sports without an advanced model contract do not receive one", () => {
  const request = buildSportsAnalyticsProviderRequest(match({ eventId: "tennis-event-1", sportKey: "tennis_atp", sport: "Tennis", league: "ATP" }));
  assert.equal(request.event.sport, "tennis");
  assert.equal(request.requestedModelContracts.length, 0);
});
