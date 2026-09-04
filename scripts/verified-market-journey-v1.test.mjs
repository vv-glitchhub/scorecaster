import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildVerifiedMarketJourneyV1,
  VERIFIED_MARKET_JOURNEY_POLICY,
  VERIFIED_MARKET_JOURNEY_VERSION
} from "../lib/verified-market-journey-v1.mjs";

test("publishes only chronology-safe same-selection market history with enough depth", () => {
  const result = buildVerifiedMarketJourneyV1({
    ok: true,
    source: "scorecaster-market-history",
    mode: "live",
    snapshotCount: 7,
    openingOdds: 2.1,
    currentOdds: 2.25,
    movementPct: 7.1429,
    spanMinutes: 96,
    openingCapturedAt: "2026-08-16T10:00:00.000Z",
    latestHistoricalCapturedAt: "2026-08-16T11:36:00.000Z",
    chronologySafe: true,
    sameEventSelection: true,
    apiKey: "must-not-leak",
    rawPayload: { secret: true }
  });

  assert.equal(result.version, VERIFIED_MARKET_JOURNEY_VERSION);
  assert.equal(result.status, "ready");
  assert.equal(result.snapshotCount, 7);
  assert.equal(result.openingOdds, 2.1);
  assert.equal(result.currentOdds, 2.25);
  assert.equal(result.movementPct, 7.1429);
  assert.equal(result.spanMinutes, 96);
  assert.equal(result.chronologySafe, true);
  assert.equal(result.sameEventSelection, true);
  assert.equal(result.externalProviderRequestMade, false);
  assert.equal(result.probabilityChanged, false);
  assert.equal(result.decisionChanged, false);
  assert.equal(result.stakeChanged, false);
  assert.equal(result.paperOnly, true);
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false);
  assert.equal(JSON.stringify(result).includes("rawPayload"), false);
});

test("fails closed on thin, short-span, non-chronological or wrong-selection history", () => {
  const base = {
    ok: true,
    source: "scorecaster-market-history",
    mode: "live",
    snapshotCount: 4,
    openingOdds: 1.9,
    currentOdds: 2.0,
    movementPct: 5.2632,
    spanMinutes: 45,
    chronologySafe: true,
    sameEventSelection: true
  };

  for (const history of [
    { ...base, snapshotCount: 2 },
    { ...base, spanMinutes: 29.99 },
    { ...base, chronologySafe: false },
    { ...base, sameEventSelection: false },
    { ...base, mode: "insufficient_history" },
    { ...base, ok: false }
  ]) {
    const result = buildVerifiedMarketJourneyV1(history);
    assert.equal(result.status, "unavailable");
    assert.equal(result.openingOdds, null);
    assert.equal(result.currentOdds, null);
    assert.equal(result.movementPct, null);
    assert.equal(result.spanMinutes, null);
    assert.equal(result.chronologySafe, false);
    assert.equal(result.sameEventSelection, false);
  }
});

test("policy matches the capture history admission thresholds", () => {
  assert.equal(VERIFIED_MARKET_JOURNEY_POLICY.minimumSnapshots, 3);
  assert.equal(VERIFIED_MARKET_JOURNEY_POLICY.minimumSpanMinutes, 30);
  assert.equal(VERIFIED_MARKET_JOURNEY_POLICY.requiresSameEventSelection, true);
  assert.equal(VERIFIED_MARKET_JOURNEY_POLICY.requiresChronologySafePregameHistory, true);
  assert.equal(VERIFIED_MARKET_JOURNEY_POLICY.externalProviderRequestMade, false);
  assert.equal(VERIFIED_MARKET_JOURNEY_POLICY.probabilityChanged, false);
  assert.equal(VERIFIED_MARKET_JOURNEY_POLICY.decisionChanged, false);
  assert.equal(VERIFIED_MARKET_JOURNEY_POLICY.stakeChanged, false);
  assert.equal(VERIFIED_MARKET_JOURNEY_POLICY.paperOnly, true);
});

test("event-detail and Match Journey UI wire the safe market history contract", () => {
  const route = fs.readFileSync(new URL("../app/api/event-detail/route.js", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../app/match-intelligence/page.jsx", import.meta.url), "utf8");
  const loader = fs.readFileSync(new URL("../app/match-intelligence/VerifiedMarketJourneyClient.jsx", import.meta.url), "utf8");
  const panel = fs.readFileSync(new URL("../app/match-intelligence/VerifiedMarketJourneyV1.jsx", import.meta.url), "utf8");

  assert.match(route, /loadVerifiedMarketHistory/);
  assert.match(route, /buildVerifiedMarketJourneyV1/);
  assert.match(route, /verifiedMarketJourney\(selectedPick\)/);
  assert.match(route, /detail\.marketHistory = marketHistory/);
  assert.match(route, /eventPicks\.find/);
  assert.match(page, /VerifiedMarketJourneyClient/);
  assert.match(loader, /\/api\/event-detail/);
  assert.match(panel, /data-verified-market-history-v1="true"/);
  assert.match(panel, /history\?\.status === "ready"/);
  assert.match(panel, /at least 3 pregame snapshots spanning at least 30 minutes/);
  assert.match(panel, /does not change probability, edge, EV, product decision or stake/);
});
