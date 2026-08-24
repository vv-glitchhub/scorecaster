import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildWatchlistState } from "../lib/watchlist-alert-engine.mjs";

const NOW = Date.parse("2026-08-24T09:00:00Z");
const AUTO_SOURCE = "scorecaster-auto-watch-recommendations-v1";

function watched(overrides = {}) {
  return {
    id: "watch-1",
    event_id: "event-1",
    sport: "soccer_norway_eliteserien",
    market: "h2h",
    selection: "Away FC",
    match: "Home FC – Away FC",
    commence_time: "2026-08-30T15:00:00Z",
    added_odds: 4.2,
    added_decision: "CAUTION",
    alert_move_percent: 0.03,
    alert_before_minutes: 120,
    active: true,
    raw_pick: {
      source: AUTO_SOURCE,
      autoWatchRank: 3,
      nearPlay: false,
      readiness: "market-only",
      paperOnly: true,
      realMoneyActionAvailable: false
    },
    ...overrides
  };
}

function current(overrides = {}) {
  return {
    eventId: "event-1",
    marketKey: "h2h",
    selection: "Away FC",
    commenceTime: "2026-08-30T15:00:00Z",
    odds: 4.25,
    productDecision: "CAUTION",
    edge: 0.025,
    ev: 0.06,
    confidence: 0.8,
    bookmakerCount: 10,
    freshnessLabel: "fresh",
    readiness: "market-only",
    evidenceVerified: false,
    recommendationRank: 3,
    recommendationScore: 74,
    consensusProbability: 0.24,
    ...overrides
  };
}

function decisionAlerts(result) {
  return result.alerts.filter((item) => item.type === "decision_changed");
}

test("CAUTION can enter Near PLAY without becoming PLAY", () => {
  const result = buildWatchlistState({ items: [watched()], currentPicks: [current()], now: NOW });
  const near = decisionAlerts(result).find((item) => /Near PLAY/i.test(item.title));
  assert.ok(near);
  assert.equal(result.items[0].current.decision, "CAUTION");
  assert.equal(result.items[0].current.nearPlay, true);
  assert.equal(result.items[0].current.failedVisibleGates.length, 1);
  assert.equal(result.items[0].current.failedVisibleGates[0], "verified-evidence");
  assert.equal(near.paperOnly, true);
  assert.equal(near.realMoneyActionAvailable, false);
  assert.equal(decisionAlerts(result).some((item) => /all Scorecaster gates passed/i.test(item.title)), false);
});

test("Near PLAY loss is surfaced when a second visible gate closes", () => {
  const item = watched({ raw_pick: { source: AUTO_SOURCE, autoWatchRank: 3, nearPlay: true, readiness: "market-only" } });
  const result = buildWatchlistState({ items: [item], currentPicks: [current({ edge: 0.01 })], now: NOW });
  const lost = decisionAlerts(result).find((alert) => /Near PLAY condition was lost/i.test(alert.title));
  assert.ok(lost);
  assert.equal(result.items[0].current.nearPlay, false);
  assert.deepEqual(new Set(result.items[0].current.failedVisibleGates), new Set(["edge", "verified-evidence"]));
  assert.equal(result.items[0].current.decision, "CAUTION");
});

test("evidence verification can alert while another gate still keeps CAUTION", () => {
  const result = buildWatchlistState({
    items: [watched()],
    currentPicks: [current({ readiness: "verified", evidenceVerified: true, edge: 0.01 })],
    now: NOW
  });
  const evidence = decisionAlerts(result).find((item) => /Independent evidence is now verified/i.test(item.title));
  assert.ok(evidence);
  assert.equal(evidence.severity, "high");
  assert.equal(result.items[0].current.decision, "CAUTION");
  assert.equal(result.items[0].current.evidenceVerified, true);
  assert.equal(result.items[0].current.nearPlay, true);
  assert.equal(result.items[0].current.failedVisibleGates[0], "edge");
});

test("Auto-Watch rank reaching number one creates a high alert without decision upgrade", () => {
  const result = buildWatchlistState({
    items: [watched()],
    currentPicks: [current({ recommendationRank: 1 })],
    now: NOW
  });
  const leader = decisionAlerts(result).find((item) => /#1 Scorecaster recommendation/i.test(item.title));
  assert.ok(leader);
  assert.equal(leader.severity, "high");
  assert.equal(leader.previousRank, 3);
  assert.equal(leader.currentRank, 1);
  assert.equal(result.items[0].current.decision, "CAUTION");
  assert.equal(leader.paperOnly, true);
  assert.equal(leader.realMoneyActionAvailable, false);
});

test("rank improvement below number one is informational only", () => {
  const item = watched({ raw_pick: { source: AUTO_SOURCE, autoWatchRank: 5, nearPlay: false, readiness: "market-only" } });
  const result = buildWatchlistState({ items: [item], currentPicks: [current({ recommendationRank: 2 })], now: NOW });
  const rank = decisionAlerts(result).find((alert) => /Recommendation rank improved/i.test(alert.title));
  assert.ok(rank);
  assert.equal(rank.severity, "info");
  assert.equal(result.items[0].current.decision, "CAUTION");
});

test("watchlist monitor uses one bounded recommendation overlay and never a betting action", async () => {
  const source = await readFile(new URL("../lib/watchlist-monitor.js", import.meta.url), "utf8");
  assert.match(source, /MAX_RECOMMENDATION_OVERLAY\s*=\s*20/);
  assert.match(source, /\/api\/recommendations/);
  assert.match(source, /loadRecommendationOverlay/);
  assert.match(source, /recommendationRank/);
  assert.match(source, /recommendationNearPlay/);
  assert.doesNotMatch(source, /placeBet|suggestedStake|realMoneyActionAvailable\s*:\s*true/i);
});
