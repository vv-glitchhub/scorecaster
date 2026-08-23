import test from "node:test";
import assert from "node:assert/strict";
import {
  compareRecommendationSnapshots,
  minimumPlayOdds,
  snapshotRecommendationFeed
} from "../lib/recommendation-change-radar.mjs";

function recommendation(overrides = {}) {
  return {
    id: "pick-1",
    eventId: "game-1",
    match: "Home vs Away",
    selection: "Home",
    marketKey: "h2h",
    rank: 1,
    decision: "CAUTION",
    odds: 2.05,
    fairOdds: 2,
    edge: 0.018,
    ev: 0.025,
    confidence: 0.7,
    bookmakerCount: 8,
    readiness: "partial",
    score: 72,
    ...overrides
  };
}

function feed(items) {
  return {
    generatedAt: "2026-08-24T00:00:00.000Z",
    recommendations: items
  };
}

test("minimum play odds corresponds to the 3% EV threshold over fair odds", () => {
  assert.equal(minimumPlayOdds(recommendation({ fairOdds: 2 })), 2.06);
  assert.equal(minimumPlayOdds(recommendation({ fairOdds: null })), null);
});

test("radar detects CAUTION to PLAY as a high severity upgrade", () => {
  const previous = snapshotRecommendationFeed(feed([recommendation()]));
  const current = snapshotRecommendationFeed(feed([
    recommendation({ decision: "PLAY", readiness: "verified", odds: 2.12, edge: 0.025, ev: 0.06 })
  ]));
  const radar = compareRecommendationSnapshots(previous, current);
  assert.equal(radar.hasMaterialChange, true);
  assert.ok(radar.changes.some((item) => item.type === "decision-upgrade" && item.severity === "high"));
  assert.ok(radar.changes.some((item) => item.type === "evidence-upgrade"));
});

test("radar detects price threshold opening without claiming PLAY", () => {
  const previous = snapshotRecommendationFeed(feed([recommendation({ odds: 2.04, fairOdds: 2 })]));
  const current = snapshotRecommendationFeed(feed([recommendation({ odds: 2.08, fairOdds: 2, decision: "CAUTION" })]));
  const radar = compareRecommendationSnapshots(previous, current);
  assert.ok(radar.changes.some((item) => item.type === "price-gate-open"));
  assert.equal(current.items[0].decision, "CAUTION");
});

test("radar detects evidence downgrade from verified", () => {
  const previous = snapshotRecommendationFeed(feed([recommendation({ readiness: "verified", decision: "PLAY" })]));
  const current = snapshotRecommendationFeed(feed([recommendation({ readiness: "partial", decision: "CAUTION" })]));
  const radar = compareRecommendationSnapshots(previous, current);
  assert.ok(radar.changes.some((item) => item.type === "evidence-downgrade" && item.severity === "high"));
  assert.ok(radar.changes.some((item) => item.type === "decision-downgrade"));
});

test("first snapshot creates a baseline without noisy change alerts", () => {
  const current = snapshotRecommendationFeed(feed([recommendation()]));
  const radar = compareRecommendationSnapshots(null, current);
  assert.equal(radar.changes.length, 0);
  assert.equal(radar.hasMaterialChange, false);
});
