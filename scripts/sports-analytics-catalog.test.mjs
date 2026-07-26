import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SPORTS_ANALYTICS_CATALOG,
  getSportsAnalyticsCoverage,
  getSportsAnalyticsDefinition,
  listSportsAnalyticsSports
} from "../lib/sports-analytics-catalog.mjs";
import {
  buildGolfProximityProfile,
  calculateDataConfidence,
  calculateExpectedDecisionValue,
  calculateExpectedPoints,
  calculateProximityGained,
  golfDistanceBucket,
  normalizeAnalyticsObservation
} from "../lib/expected-performance-engine.mjs";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("catalog covers the initial multi-sport Scorecaster expansion", () => {
  const sports = listSportsAnalyticsSports();
  assert.ok(sports.length >= 15);
  for (const sport of ["soccer", "ice_hockey", "basketball", "american_football", "baseball", "tennis", "golf", "combat_sports"]) {
    assert.ok(SPORTS_ANALYTICS_CATALOG[sport]);
    assert.ok(getSportsAnalyticsDefinition(sport).families.expected.length >= 4);
  }
});

test("catalog exposes golf proximity and decision metrics", () => {
  const golf = getSportsAnalyticsDefinition("golf");
  assert.ok(golf.families.expected.includes("expected-proximity"));
  assert.ok(golf.families.expected.includes("proximity-gained"));
  assert.ok(golf.families.counterfactual.includes("club-selection-value"));
});

test("coverage remains explicit instead of inventing missing metrics", () => {
  const coverage = getSportsAnalyticsCoverage("ice_hockey", ["xg", "shot-speed", "zone-time"]);
  assert.equal(coverage.availableMetricCount, 3);
  assert.ok(coverage.requiredMetricCount > coverage.availableMetricCount);
  assert.ok(coverage.families.some((family) => family.missingMetrics.length > 0));
});

test("golf proximity profile groups shots by starting distance", () => {
  const profile = buildGolfProximityProfile([
    { startDistanceMeters: 82, endDistanceMeters: 4, expectedEndDistanceMeters: 7, greenHit: true },
    { startDistanceMeters: 94, endDistanceMeters: 8, expectedEndDistanceMeters: 7, greenHit: true },
    { startDistanceMeters: 142, endDistanceMeters: 11, expectedEndDistanceMeters: 13, greenHit: false }
  ]);
  assert.equal(golfDistanceBucket(82), "75-100 m");
  assert.equal(profile[0].bucket, "75-100 m");
  assert.equal(profile[0].samples, 2);
  assert.equal(profile[0].averageEndDistanceMeters, 6);
  assert.equal(profile[0].proximityGainedMeters, 1);
  assert.equal(profile[0].targetZoneRates["5m"], 0.5);
  assert.equal(calculateProximityGained({ expectedDistanceMeters: 11.2, actualDistanceMeters: 6.7 }), 4.5);
});

test("generic expected-value helpers are deterministic", () => {
  assert.equal(calculateExpectedPoints({ probability: 0.38, points: 3 }), 1.14);
  assert.equal(calculateExpectedPoints({ probability: null, points: 3 }), null);
  assert.equal(golfDistanceBucket(null), null);
  assert.deepEqual(calculateExpectedDecisionValue({ chosenValue: 0.06, alternatives: [0.25, 0.12] }), {
    chosenValue: 0.06,
    bestAlternativeValue: 0.25,
    decisionValue: -0.19,
    optimal: false
  });
});

test("data confidence and observation normalization stay bounded", () => {
  const confidence = calculateDataConfidence({ sampleSize: 200, freshnessSeconds: 60, providerCount: 4, agreement: 0.9, completeness: 0.95 });
  assert.ok(confidence.score > 0.8 && confidence.score <= 1);
  const observation = normalizeAnalyticsObservation({
    sport: "Ice Hockey",
    eventId: "game-1",
    metric: "Shot Speed",
    value: "161.2",
    unit: "km/h",
    observedAt: "2026-07-26T10:00:00Z",
    sourceTrust: 2,
    confidence: -1
  });
  assert.equal(observation.sport, "ice_hockey");
  assert.equal(observation.metric, "shot-speed");
  assert.equal(observation.sourceTrust, 1);
  assert.equal(observation.confidence, 0);
});

test("catalog API preserves Scorecaster safety boundaries", async () => {
  const api = await source("app/api/sports-analytics/catalog/route.js");
  assert.match(api, /no-vig-market-consensus/);
  assert.match(api, /analyticsCanUpgradeDecision: false/);
  assert.match(api, /researchMetricsAreShadowOnly: true/);
  assert.match(api, /paperOnly: true/);
});
