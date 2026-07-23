import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildUnifiedCalibrationRows, summarizeUnifiedCalibration } from "../lib/unified-data-calibration.mjs";

const close = {
  event_id: "event-cal",
  selection: "Home",
  sport_key: "soccer_epl",
  league: "Premier League",
  commence_time: "2026-07-23T18:00:00.000Z",
  opening_odds: 2.2,
  opening_captured_at: "2026-07-23T08:00:00.000Z",
  closing_odds: 2,
  closing_captured_at: "2026-07-23T17:47:00.000Z",
  price_clv: 0.1,
  opening_snapshot_id: "opening",
  closing_snapshot_id: "closing"
};

const snapshots = [
  { id: "opening", event_id: "event-cal", selection: "Home", captured_at: "2026-07-23T08:00:00.000Z", commence_time: close.commence_time, odds: 2.2, decision: "CAUTION", provider_count: 1, coverage_score: 0.4 },
  { id: "closing", event_id: "event-cal", selection: "Home", captured_at: "2026-07-23T17:47:00.000Z", commence_time: close.commence_time, odds: 2, decision: "PLAY", market_probability: 0.5, provider_count: 2, provider_disagreement: 0.03, coverage_score: 0.8, used_factor_count: 7, total_context_impact: -0.01, safety_action: "retain", factor_statuses: { injuries: { status: "checked-no-impact" } } },
  { id: "post", event_id: "event-cal", selection: "Home", captured_at: "2026-07-23T18:10:00.000Z", commence_time: close.commence_time, odds: 1.7, decision: "PLAY", provider_count: 2, coverage_score: 0.9 }
];

test("calibration row uses final pre-start snapshot and excludes post-start data", () => {
  const rows = buildUnifiedCalibrationRows({ closingRecords: [close], snapshots, now: Date.parse("2026-07-24T00:00:00.000Z") });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].chronology.finalSnapshotId, "closing");
  assert.equal(rows[0].chronology.postStartSnapshotUsed, false);
  assert.equal(rows[0].pregameFeatures.providerCount, 2);
  assert.equal(rows[0].market.closingOdds, 2);
  assert.equal(rows[0].market.priceClv, 0.1);
  assert.ok(rows[0].forbiddenUses.includes("pregame-probability"));
  assert.ok(rows[0].forbiddenUses.includes("automatic-play-upgrade"));
});

test("calibration rejects a closing record that points after event start", () => {
  const invalid = { ...close, closing_captured_at: "2026-07-23T18:10:00.000Z", closing_snapshot_id: "post" };
  const rows = buildUnifiedCalibrationRows({ closingRecords: [invalid], snapshots, now: Date.parse("2026-07-24T00:00:00.000Z") });
  assert.equal(rows.length, 0);
});

test("calibration summary groups CLV by provider count", () => {
  const rows = buildUnifiedCalibrationRows({ closingRecords: [close], snapshots, now: Date.parse("2026-07-24T00:00:00.000Z") });
  const summary = summarizeUnifiedCalibration(rows);
  assert.equal(summary.sampleSize, 1);
  assert.equal(summary.averagePriceClv, 0.1);
  assert.equal(summary.positiveClvRate, 1);
  assert.equal(summary.byProviderCount["2"].samples, 1);
});

test("calibration API exposes chronology guards and no outcome leakage", async () => {
  const api = await readFile(new URL("../app/api/data-layer/calibration/route.js", import.meta.url), "utf8");
  assert.match(api, /chronologyGuard: true/);
  assert.match(api, /pregameClosingLeakage: false/);
  assert.match(api, /outcomeUsed: false/);
  assert.match(api, /contextCanUpgrade: false/);
  assert.doesNotMatch(api, /realMoneyBetting:\s*true/);
});