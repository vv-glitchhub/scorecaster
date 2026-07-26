import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMetricActivationPriorities,
  buildSportCoverageMatrix,
  buildSportsAnalyticsActivationPlan
} from "../lib/sports-analytics-activation.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const snapshots = [
  {
    event_id: "nhl-1",
    canonical_sport: "ice_hockey",
    captured_at: "2026-07-26T08:00:00Z",
    provider_count: 1,
    available_metrics: ["xg", "post-shot-xg"]
  },
  {
    event_id: "nhl-2",
    canonical_sport: "ice_hockey",
    captured_at: "2026-07-26T08:00:00Z",
    provider_count: 2,
    available_metrics: ["xg", "shot-speed", "zone-time"]
  },
  {
    event_id: "golf-1",
    canonical_sport: "golf",
    captured_at: "2026-07-26T08:00:00Z",
    provider_count: 1,
    available_metrics: ["expected-proximity", "proximity-gained"]
  },
  {
    event_id: "golf-1",
    canonical_sport: "golf",
    captured_at: "2026-07-26T07:30:00Z",
    provider_count: 1,
    available_metrics: ["expected-proximity"]
  }
];

test("coverage matrix uses the latest snapshot per event and real available metrics", () => {
  const matrix = buildSportCoverageMatrix(snapshots);
  const hockey = matrix.find((row) => row.sport === "ice_hockey");
  const golf = matrix.find((row) => row.sport === "golf");
  assert.equal(hockey.events, 2);
  assert.equal(hockey.providers, 2);
  assert.ok(hockey.availableMetrics >= 4);
  assert.equal(golf.events, 1);
  assert.ok(golf.coverage > 0 && golf.coverage < 1);
  assert.ok(golf.families.some((row) => row.family === "expected" && row.available > 0));
});

test("activation priorities rank missing expected and tracking metrics without inventing availability", () => {
  const priorities = buildMetricActivationPriorities(snapshots, { maxItems: 200 });
  assert.ok(priorities.length > 0);
  assert.ok(priorities.some((row) => row.sport === "ice_hockey" && row.family === "expected" && row.metric === "expected-zone-entry-value"));
  assert.ok(priorities.some((row) => row.requiredSourceType === "tracking feed"));
  assert.ok(priorities.every((row) => row.priorityScore > 0));
  assert.ok(priorities.every((row) => row.currentFamilyCoverage >= 0 && row.currentFamilyCoverage <= 1));
});

test("activation plan stays recommendation-only", () => {
  const plan = buildSportsAnalyticsActivationPlan(snapshots);
  assert.equal(plan.policy.recommendationOnly, true);
  assert.equal(plan.policy.automaticProviderPurchase, false);
  assert.equal(plan.policy.automaticProbabilityChange, false);
  assert.equal(plan.policy.missingDataInvented, false);
});

test("visual page renders the activation queue and heatmap", async () => {
  const page = await source("app/sports-analytics/page.jsx");
  const client = await source("app/sports-analytics/SportsAnalyticsActivationClient.jsx");
  const api = await source("app/api/sports-analytics/route.js");
  assert.match(page, /SportsAnalyticsActivationClient/);
  assert.match(client, /Metric activation queue/);
  assert.match(client, /Family coverage heatmap/);
  assert.match(client, /Automatic activation plan/);
  assert.match(api, /buildSportsAnalyticsActivationPlan/);
  assert.match(api, /activationPlan/);
  assert.doesNotMatch(client, /SPORTS_ANALYTICS_API_KEY|CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY/);
});
