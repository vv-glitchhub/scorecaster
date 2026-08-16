import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { VERIFIED_MARKET_JOURNEY_POLICY } from "../lib/verified-market-journey-v1.mjs";
import {
  buildProductionEvidenceMarketJourneyV1,
  PRODUCTION_EVIDENCE_MARKET_JOURNEY_VERSION
} from "../lib/production-evidence-market-journey-v1.mjs";

const NOW = Date.parse("2026-08-16T18:00:00.000Z");
const FUTURE = "2026-08-16T20:00:00.000Z";

function row(eventId, selection, capturedAt, commenceTime = FUTURE) {
  return {
    event_id: eventId,
    selection,
    captured_at: capturedAt,
    commence_time: commenceTime,
    provider: "must-not-leak",
    data: { secret: true }
  };
}

test("empty evidence reports an explicit zero aggregate", () => {
  const report = buildProductionEvidenceMarketJourneyV1([], { now: NOW });
  assert.equal(report.version, PRODUCTION_EVIDENCE_MARKET_JOURNEY_VERSION);
  assert.equal(report.futureEventSelections, 0);
  assert.equal(report.journeyReady, 0);
  assert.equal(report.readyRatePct, 0);
  assert.equal(report.thinHistory, 0);
  assert.equal(report.shortSpan, 0);
  assert.equal(report.maxSnapshots, 0);
  assert.equal(report.maxSpanMinutes, 0);
});

test("classifies thin, short-span and ready future pregame histories", () => {
  const report = buildProductionEvidenceMarketJourneyV1([
    row("thin", "home", "2026-08-16T18:10:00.000Z"),
    row("thin", "home", "2026-08-16T18:20:00.000Z"),
    row("short", "away", "2026-08-16T18:10:00.000Z"),
    row("short", "away", "2026-08-16T18:20:00.000Z"),
    row("short", "away", "2026-08-16T18:29:00.000Z"),
    row("ready", "over", "2026-08-16T18:05:00.000Z"),
    row("ready", "over", "2026-08-16T18:25:00.000Z"),
    row("ready", "over", "2026-08-16T18:40:00.000Z")
  ], { now: NOW });

  assert.equal(report.futureEventSelections, 3);
  assert.equal(report.journeyReady, 1);
  assert.equal(report.readyRatePct, 33.3);
  assert.equal(report.thinHistory, 1);
  assert.equal(report.shortSpan, 1);
  assert.equal(report.maxSnapshots, 3);
  assert.equal(report.maxSpanMinutes, 35);
});

test("ignores past events, post-kickoff rows and rows without event-selection identity", () => {
  const report = buildProductionEvidenceMarketJourneyV1([
    row("past", "home", "2026-08-16T16:00:00.000Z", "2026-08-16T17:00:00.000Z"),
    row("post", "home", "2026-08-16T20:01:00.000Z", FUTURE),
    row("", "home", "2026-08-16T18:10:00.000Z"),
    row("missing-selection", "", "2026-08-16T18:10:00.000Z")
  ], { now: NOW });

  assert.equal(report.futureEventSelections, 0);
  assert.equal(report.journeyReady, 0);
});

test("deduplicates identical capture timestamps inside one event-selection history", () => {
  const report = buildProductionEvidenceMarketJourneyV1([
    row("event", "home", "2026-08-16T18:05:00.000Z"),
    row("event", "home", "2026-08-16T18:05:00.000Z"),
    row("event", "home", "2026-08-16T18:20:00.000Z"),
    row("event", "home", "2026-08-16T18:40:00.000Z")
  ], { now: NOW });

  assert.equal(report.futureEventSelections, 1);
  assert.equal(report.maxSnapshots, 3);
  assert.equal(report.journeyReady, 1);
});

test("telemetry shares Match Journey policy and never leaks row identity or payload data", () => {
  const report = buildProductionEvidenceMarketJourneyV1([
    row("private-event-id", "private-selection", "2026-08-16T18:05:00.000Z"),
    row("private-event-id", "private-selection", "2026-08-16T18:25:00.000Z"),
    row("private-event-id", "private-selection", "2026-08-16T18:40:00.000Z")
  ], { now: NOW });

  assert.equal(report.thresholds.minimumSnapshots, VERIFIED_MARKET_JOURNEY_POLICY.minimumSnapshots);
  assert.equal(report.thresholds.minimumSpanMinutes, VERIFIED_MARKET_JOURNEY_POLICY.minimumSpanMinutes);
  assert.equal(report.safety.aggregateOnly, true);
  assert.equal(report.safety.rawSnapshotsExposed, false);
  assert.equal(report.safety.eventIdentifiersExposed, false);
  assert.equal(report.safety.selectionsExposed, false);
  assert.equal(report.safety.probabilityChanged, false);
  assert.equal(report.safety.decisionChanged, false);
  assert.equal(report.safety.stakeChanged, false);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("private-event-id"), false);
  assert.equal(serialized.includes("private-selection"), false);
  assert.equal(serialized.includes("must-not-leak"), false);
  assert.equal(serialized.includes("secret"), false);
});

test("production evidence route selects selection identity and attaches only aggregate telemetry", () => {
  const route = fs.readFileSync(new URL("../app/api/production-evidence/route.js", import.meta.url), "utf8");
  assert.match(route, /production-evidence-market-journey-v1/);
  assert.match(route, /event_id,selection,sport_key/);
  assert.match(route, /buildProductionEvidenceMarketJourneyV1\(snapshots\.rows/);
  assert.match(route, /verifiedMarketJourney/);
  assert.doesNotMatch(route, /\.select\([^)]*data/);
});
