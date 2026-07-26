import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildEventAnalyticsDrilldowns,
  buildMetricTimeSeries,
  buildParticipantMetricLeaders,
  buildProviderQualitySummary,
  buildSportsAnalyticsInsights,
  detectSportsAnalyticsIncidents
} from "../lib/sports-analytics-insights.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const observations = [
  { eventId: "e1", canonicalSport: "golf", participantId: "Player A", family: "expected", metric: "expected-proximity", value: 8, unit: "m", observedAt: "2026-07-26T06:00:00Z", capturedAt: "2026-07-26T06:00:00Z", provider: "provider-a", sourceTrust: 0.9, confidence: 0.8 },
  { eventId: "e1", canonicalSport: "golf", participantId: "Player A", family: "expected", metric: "expected-proximity", value: 6, unit: "m", observedAt: "2026-07-26T06:30:00Z", capturedAt: "2026-07-26T06:30:00Z", provider: "provider-a", sourceTrust: 0.9, confidence: 0.85 },
  { eventId: "e1", canonicalSport: "golf", participantId: "Player B", family: "expected", metric: "expected-proximity", value: 10, unit: "m", observedAt: "2026-07-26T06:30:00Z", capturedAt: "2026-07-26T06:30:00Z", provider: "provider-b", sourceTrust: 0.7, confidence: 0.65 },
  { eventId: "e2", canonicalSport: "soccer", participantId: "Home", family: "expected", metric: "xg", value: 1.4, unit: "goals", observedAt: "2026-07-26T06:30:00Z", capturedAt: "2026-07-26T06:30:00Z", provider: "provider-a", sourceTrust: 0.9, confidence: 0.8 },
  { eventId: "e2", canonicalSport: "soccer", participantId: "Away", family: "expected", metric: "xg", value: 0.8, unit: "goals", observedAt: "2026-07-26T06:30:00Z", capturedAt: "2026-07-26T06:30:00Z", provider: "provider-a", sourceTrust: 0.9, confidence: 0.8 }
];

const snapshots = [
  { event_id: "e1", canonical_sport: "golf", league: "Tour", match: "Player A vs Player B", captured_at: "2026-07-26T06:30:00Z", observation_count: 3, provider_count: 2, coverage_score: 0.2, available_metrics: ["expected-proximity"], missing_metrics: ["strokes-gained"] },
  { event_id: "e1", canonical_sport: "golf", league: "Tour", match: "Player A vs Player B", captured_at: "2026-07-26T06:00:00Z", observation_count: 1, provider_count: 1, coverage_score: 0.1 },
  { event_id: "e2", canonical_sport: "soccer", league: "League", match: "Home vs Away", captured_at: "2026-07-26T06:30:00Z", observation_count: 2, provider_count: 1, coverage_score: 0.12, available_metrics: ["xg"], missing_metrics: ["xa"] }
];

test("metric series groups numeric observations into chronological 30-minute points", () => {
  const series = buildMetricTimeSeries(observations, { maxSeries: 20 });
  const proximity = series.find((row) => row.metric === "expected-proximity");
  assert.equal(proximity.points.length, 2);
  assert.equal(proximity.points[0].value, 8);
  assert.equal(proximity.points[1].value, 8);
  assert.equal(proximity.samples, 3);
  assert.equal(proximity.events, 1);
  assert.equal(proximity.providers, 2);
});

test("provider quality remains bounded and reports freshness", () => {
  const providers = buildProviderQualitySummary(observations, { now: Date.parse("2026-07-26T07:00:00Z") });
  assert.equal(providers.length, 2);
  assert.equal(providers[0].status, "fresh");
  assert.ok(providers.every((row) => row.score >= 0 && row.score <= 1));
  assert.ok(providers.every((row) => ["A", "B", "C", "D", "E"].includes(row.grade)));
});

test("participant leaders compare only metrics with multiple participants", () => {
  const leaderboards = buildParticipantMetricLeaders(observations, { maxMetrics: 20 });
  const xg = leaderboards.find((row) => row.metric === "xg");
  assert.equal(xg.participants.length, 2);
  assert.equal(xg.participants[0].participantId, "Home");
  assert.equal(xg.participants[0].average, 1.4);
});

test("event drilldown keeps only the latest snapshot and latest participant metric", () => {
  const events = buildEventAnalyticsDrilldowns(snapshots, observations);
  assert.equal(events.length, 2);
  const golf = events.find((row) => row.eventId === "e1");
  assert.equal(golf.capturedAt, "2026-07-26T06:30:00Z");
  assert.equal(golf.metrics.filter((row) => row.participantId === "Player A" && row.metric === "expected-proximity").length, 1);
  assert.equal(golf.metrics.find((row) => row.participantId === "Player A").value, 6);
});

test("incidents identify stale capture without changing probabilities", () => {
  const providers = buildProviderQualitySummary(observations, { now: Date.parse("2026-07-27T06:30:00Z") });
  const incidents = detectSportsAnalyticsIncidents(snapshots, providers, { now: Date.parse("2026-07-27T06:30:00Z") });
  assert.ok(incidents.some((row) => row.id === "capture-stale" && row.severity === "critical"));
  const insights = buildSportsAnalyticsInsights({ snapshots, observations, now: Date.parse("2026-07-26T07:00:00Z") });
  assert.ok(Array.isArray(insights.metricSeries));
  assert.ok(Array.isArray(insights.providerQuality));
  assert.ok(Array.isArray(insights.events));
});

test("API and UI expose trends, provider quality, drilldowns and CSV export", async () => {
  const api = await source("app/api/sports-analytics/route.js");
  const client = await source("app/sports-analytics/SportsAnalyticsClient.jsx");
  const csv = await source("app/api/sports-analytics/export/route.js");
  assert.match(api, /buildSportsAnalyticsInsights/);
  assert.match(api, /insights/);
  assert.match(client, /Metric trend/);
  assert.match(client, /Provider quality/);
  assert.match(client, /Event drilldown/);
  assert.match(client, /CSV/);
  assert.match(csv, /text\/csv/);
  assert.doesNotMatch(csv, /SPORTS_ANALYTICS_API_KEY|CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY/);
});
