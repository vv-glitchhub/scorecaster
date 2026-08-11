import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSportsAnalyticsProviderRequest,
  SPORTS_ANALYTICS_NHL_XG_GOALIE_REQUESTED_METRICS
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

test("sports analytics V2 requests all NHL xG goalie shadow metrics", () => {
  const request = buildSportsAnalyticsProviderRequest(nhlMatch());
  assert.equal(request.contract, "scorecaster-sports-analytics-v2");
  assert.equal(request.event.sport, "ice_hockey");
  for (const metric of SPORTS_ANALYTICS_NHL_XG_GOALIE_REQUESTED_METRICS) {
    assert.ok(request.requestedMetrics.includes(metric), metric);
  }
  assert.equal(request.policy.marketPricingCannotBeUsedAsIndependentModelInput, true);
  assert.equal(request.policy.paperOnly, true);
});

test("NHL provider request exposes a strict model input contract", () => {
  const request = buildSportsAnalyticsProviderRequest(nhlMatch());
  const contract = request.requestedModelContracts.find((item) => item.modelId === "nhl-xg-goalie-poisson-v1");
  assert.ok(contract);
  assert.deepEqual(contract.requiredMetrics, [
    "xg-for-per-60",
    "xg-against-per-60",
    "goals-saved-above-expected-per-60"
  ]);
  assert.deepEqual(contract.optionalMetrics, ["post-shot-xg-for-per-60"]);
  assert.match(contract.participantContract.goalieMetric, /starter=true/);
  assert.equal(contract.independentFromMarketPricing, true);
  assert.equal(contract.units, "per-60");
});

test("non-NHL sports do not receive the NHL-specific model contract", () => {
  const request = buildSportsAnalyticsProviderRequest({
    eventId: "nba-event-1",
    sportKey: "basketball_nba",
    sport: "NBA",
    league: "NBA",
    homeTeam: "Home",
    awayTeam: "Away"
  });
  assert.equal(request.event.sport, "basketball");
  assert.equal(request.requestedModelContracts.length, 0);
});
