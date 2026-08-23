import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendation, buildRecommendationFeed } from "../lib/recommendation-engine.mjs";

function pick(overrides = {}) {
  return {
    id: "pick-1",
    eventId: "game-1",
    match: "Home – Away",
    selection: "Home",
    odds: 2.15,
    fairOdds: 2.02,
    edge: 0.03,
    ev: 0.05,
    confidence: 0.68,
    trustScore: 78,
    bookmakerCount: 6,
    freshnessLabel: "fresh",
    productDecision: "PLAY",
    sportsIntelligence: {
      readiness: { level: "verified", allowsIndependentPlayEvidence: true },
      conflicts: []
    },
    ...overrides
  };
}

test("PLAY recommendation exposes positive reasons without changing the production decision", () => {
  const result = buildRecommendation(pick());
  assert.equal(result.decision, "PLAY");
  assert.equal(result.paperOnly, true);
  assert.equal(result.realMoneyActionAvailable, false);
  assert.ok(result.score >= 70);
  assert.ok(result.reasons.some((item) => item.code === "positive-edge"));
  assert.ok(result.reasons.some((item) => item.code === "positive-ev"));
  assert.ok(result.reasons.some((item) => item.code === "verified-evidence"));
});

test("ranking never upgrades CAUTION to PLAY", () => {
  const feed = buildRecommendationFeed([
    pick({ id: "caution", productDecision: "CAUTION", edge: 0.08, ev: 0.12, trustScore: 95 }),
    pick({ id: "play", productDecision: "PLAY", edge: 0.021, ev: 0.031, trustScore: 70 })
  ]);
  assert.equal(feed.recommendations[0].id, "play");
  assert.equal(feed.recommendations[0].decision, "PLAY");
  assert.equal(feed.recommendations[1].decision, "CAUTION");
});

test("feed returns a CAUTION watch candidate when no PLAY exists", () => {
  const feed = buildRecommendationFeed([
    pick({ id: "skip", productDecision: "SKIP", edge: -0.01, ev: -0.02 }),
    pick({ id: "watch", productDecision: "CAUTION", edge: 0.018, ev: 0.027, sportsIntelligence: { readiness: { level: "partial" }, conflicts: [] } })
  ]);
  assert.equal(feed.hasPlayablePick, false);
  assert.equal(feed.topRecommendation.id, "watch");
  assert.equal(feed.topRecommendation.decision, "CAUTION");
});

test("unverified evidence is surfaced as a warning", () => {
  const result = buildRecommendation(pick({
    productDecision: "CAUTION",
    sportsIntelligence: { readiness: { level: "market-only" }, conflicts: [] }
  }));
  assert.ok(result.warnings.some((item) => item.code === "evidence-not-verified"));
  assert.equal(result.decision, "CAUTION");
});

test("stale and thin market data are visible in warnings", () => {
  const result = buildRecommendation(pick({
    productDecision: "SKIP",
    freshnessLabel: "stale",
    bookmakerCount: 1,
    confidence: 0.25,
    edge: 0.002,
    ev: -0.01
  }));
  const codes = new Set(result.warnings.map((item) => item.code));
  assert.equal(codes.has("stale-data"), true);
  assert.equal(codes.has("thin-market"), true);
  assert.equal(codes.has("low-confidence"), true);
  assert.equal(result.decision, "SKIP");
});
