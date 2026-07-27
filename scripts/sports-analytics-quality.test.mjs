import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildSportsAnalyticsQualityReport,
  detectMetricOutliers,
  summarizeObservationQuality,
  validateSportsAnalyticsObservation
} from "../lib/sports-analytics-quality.mjs";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const base = {
  eventId: "event-1",
  canonicalSport: "golf",
  metric: "expected-proximity",
  value: 8.2,
  unit: "m",
  observedAt: "2026-07-26T10:00:00Z",
  capturedAt: "2026-07-26T10:01:00Z",
  provider: "provider-a",
  sourceTrust: 0.8,
  confidence: 0.7
};

test("quality validator rejects missing identity and impossible unit values", () => {
  assert.equal(validateSportsAnalyticsObservation(base, { now: Date.parse("2026-07-26T11:00:00Z") }).ok, true);
  const invalid = validateSportsAnalyticsObservation({ ...base, eventId: "", value: -2 }, { now: Date.parse("2026-07-26T11:00:00Z") });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes("event-id-missing"));
  assert.ok(invalid.errors.includes("value-out-of-range"));
});

test("future observations fail closed", () => {
  const result = validateSportsAnalyticsObservation({ ...base, observedAt: "2026-07-27T10:00:00Z" }, { now: Date.parse("2026-07-26T11:00:00Z") });
  assert.ok(result.errors.includes("observed-at-in-future"));
});

test("quality summary exposes invalid rows without inventing replacements", () => {
  const report = summarizeObservationQuality([base, { ...base, eventId: "", value: null }], { now: Date.parse("2026-07-26T11:00:00Z") });
  assert.equal(report.total, 2);
  assert.equal(report.valid, 1);
  assert.equal(report.invalid, 1);
  assert.equal(report.validRate, 0.5);
});

test("outlier detection is warning-only and deterministic", () => {
  const observations = Array.from({ length: 10 }, (_, index) => ({ ...base, eventId: `event-${index}`, value: index === 9 ? 100 : 10 + index * 0.05 }));
  const outliers = detectMetricOutliers(observations, { minimumSamples: 8, zThreshold: 2.5 });
  assert.equal(outliers.length, 1);
  assert.equal(outliers[0].eventId, "event-9");
  const report = buildSportsAnalyticsQualityReport(observations, { now: Date.parse("2026-07-26T11:00:00Z"), zThreshold: 2.5 });
  assert.equal(report.rules.statisticalOutliersAreWarningsOnly, true);
  assert.equal(report.rules.missingValuesInvented, false);
});

test("health, maintenance and event routes preserve access and paper-only boundaries", async () => {
  const [health, maintenance, eventClient] = await Promise.all([
    source("app/api/sports-analytics/health/route.js"),
    source("app/api/internal/sports-analytics-maintenance/route.js"),
    source("app/sports-analytics/event/[eventId]/SportsAnalyticsEventClient.jsx")
  ]);
  assert.match(health, /sports-analytics-health-v1/);
  assert.match(maintenance, /authorization/);
  assert.match(maintenance, /retentionDays/);
  assert.match(maintenance, /paperOnly: true/);
  assert.match(eventClient, /api\/sports-analytics\?eventId=/);
  assert.match(eventClient, /no-vig market consensus/);
});
