import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRecommendationJourney } from "../lib/recommendation-journey-v1.mjs";

const timeline = {
  eventId: "event-1",
  selection: "Home FC",
  points: [
    { eventId: "event-1", selection: "Home FC", odds: 2.2, decision: "CAUTION", edge: 0.015, ev: 0.025, confidence: 0.53, bookmaker: "A", capturedAt: "2026-08-24T08:00:00Z" },
    { eventId: "event-1", selection: "Home FC", odds: 2.3, decision: "CAUTION", edge: 0.022, ev: 0.04, confidence: 0.58, bookmaker: "B", capturedAt: "2026-08-24T09:00:00Z" },
    { eventId: "event-1", selection: "Home FC", odds: 2.1, decision: "PLAY", edge: 0.021, ev: 0.035, confidence: 0.6, bookmaker: "B", capturedAt: "2026-08-24T10:00:00Z" }
  ]
};

test("Journey derives only observed market and decision events", () => {
  const journey = buildRecommendationJourney(timeline, {
    decision: "PLAY",
    rank: 1,
    score: 85,
    odds: 2.1,
    fairOdds: 2.0,
    minimumEvOdds: 2.06,
    edge: 0.021,
    ev: 0.035,
    confidence: 0.6,
    bookmakerCount: 8,
    readiness: "verified",
    freshness: "fresh",
    nextGate: { code: "maintain-play-gates" },
    intelligenceV2: { nearPlay: false, visiblePlayGates: [] }
  });

  assert.equal(journey.status, "available");
  assert.equal(journey.summary.observations, 3);
  assert.equal(journey.summary.decisionChanges, 1);
  assert.ok(journey.summary.significantPriceMoves >= 1);
  assert.equal(journey.summary.gateChanges, 3);
  assert.equal(journey.current.readiness, "verified");
  assert.equal(journey.current.decision, "PLAY");
  assert.equal(journey.historicalEvidenceReadinessStored, false);
  assert.equal(journey.decisionUpgradeAllowed, false);
  assert.equal(journey.probabilityAdjusted, false);
  assert.equal(journey.realMoneyActionAvailable, false);
});

test("Journey never invents historical evidence readiness", () => {
  const journey = buildRecommendationJourney(timeline, { decision: "CAUTION", readiness: "market-only", intelligenceV2: {} });
  assert.equal(journey.historicalEvidenceReadinessStored, false);
  assert.match(journey.limitation, /not reconstructed/i);
  for (const event of journey.events) {
    assert.equal("readiness" in event, false);
    assert.equal("evidenceVerified" in event, false);
  }
});

test("Journey client uses private watchlist and timeline APIs but no betting endpoint", async () => {
  const source = await readFile(new URL("../app/journey/JourneyClient.jsx", import.meta.url), "utf8");
  assert.match(source, /\/api\/cloud\/watchlist/);
  assert.match(source, /\/api\/cloud\/market-timeline/);
  assert.match(source, /\/api\/recommendations\?limit=20/);
  assert.match(source, /historical independent-evidence readiness/i);
  assert.doesNotMatch(source, /\/api\/cloud\/bets|placeBet|suggestedStake/i);
});
