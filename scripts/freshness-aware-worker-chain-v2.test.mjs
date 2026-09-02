import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateUnifiedCaptureFreshness,
  UNIFIED_CAPTURE_FRESHNESS_MINUTES,
  UNIFIED_CAPTURE_FRESHNESS_POLICY
} from "../lib/unified-capture-freshness-v1.mjs";

const NOW = Date.parse("2026-08-15T04:30:00Z");
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("15-minute policy skips 14.9-minute capture and requires worker exactly at 15 minutes", () => {
  const fresh = evaluateUnifiedCaptureFreshness({
    latestCapturedAt: new Date(NOW - 14.9 * 60_000).toISOString(),
    now: NOW
  });
  const boundary = evaluateUnifiedCaptureFreshness({
    latestCapturedAt: new Date(NOW - 15 * 60_000).toISOString(),
    now: NOW
  });
  assert.equal(UNIFIED_CAPTURE_FRESHNESS_MINUTES, 15);
  assert.equal(fresh.fresh, true);
  assert.equal(fresh.protectedWorkerRequired, false);
  assert.equal(boundary.fresh, false);
  assert.equal(boundary.protectedWorkerRequired, true);
});

test("missing capture fails toward acquisition, never toward a false fresh state", () => {
  const missing = evaluateUnifiedCaptureFreshness({ latestCapturedAt: null, now: NOW });
  assert.equal(missing.fresh, false);
  assert.equal(missing.protectedWorkerRequired, true);
  assert.equal(missing.latestCapturedAt, null);
  assert.equal(UNIFIED_CAPTURE_FRESHNESS_POLICY.missingLatestCaptureMeansStale, true);
  assert.equal(UNIFIED_CAPTURE_FRESHNESS_POLICY.paperOnly, true);
});

test("public freshness endpoint returns only bounded capture-age metadata", async () => {
  const route = await source("app/api/unified-data/freshness/route.js");
  assert.match(route, /\.from\("unified_data_snapshots"\)/);
  assert.match(route, /\.select\("captured_at"\)/);
  assert.match(route, /protectedWorkerRequired/);
  assert.match(route, /paperOnly: true/);
  assert.match(route, /no-store, max-age=0/);
  assert.doesNotMatch(route, /event_id|selection|home_team|away_team|provider_key|raw_pick|user_id/);
  assert.doesNotMatch(route, /CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY|authorization/i);
});

test("protected Unified Data worker contract remains unchanged", async () => {
  const route = await source("app/api/internal/unified-data/route.js");
  assert.match(route, /if \(!authorized\(request\)\)/);
  assert.match(route, /version:\s*"unified-sports-data-worker-v3"/);
  assert.doesNotMatch(route, /unified-capture-freshness-v1|protectedWorkerRequired|skipIfFreshMinutes/);
});

test("Collector and fallback serialize acquisition and consult freshness before protected capture", async () => {
  const collector = await source(".github/workflows/collector.yml");
  const fallback = await source(".github/workflows/unified-data-capture.yml");

  for (const workflow of [collector, fallback]) {
    assert.match(workflow, /group: scorecaster-data-pipeline/);
    assert.match(workflow, /\/api\/unified-data\/freshness/);
    assert.match(workflow, /required=true/);
    assert.match(workflow, /protectedWorkerRequired \/\/ true/);
    assert.match(workflow, /if: steps\.freshness\.outputs\.required == 'true'/);
    assert.match(workflow, /\/api\/internal\/unified-data/);
    assert.match(workflow, /\/api\/internal\/sports-analytics/);
    assert.match(workflow, /-o \/tmp\/unified\.json/);
    assert.doesNotMatch(workflow, /cat \/tmp\/(collector|unified|sports-analytics|freshness)\.json/);
  }

  const collectIndex = collector.indexOf("/api/internal/collector");
  const freshnessIndex = collector.indexOf("/api/unified-data/freshness");
  const unifiedIndex = collector.indexOf("/api/internal/unified-data");
  const analyticsIndex = collector.indexOf("/api/internal/sports-analytics");
  assert.ok(collectIndex >= 0 && freshnessIndex > collectIndex && unifiedIndex > freshnessIndex && analyticsIndex > unifiedIndex);
  assert.match(fallback, /cron: "17,47 \* \* \* \*"/);
});

test("freshness probe failure defaults to running protected capture", async () => {
  const collector = await source(".github/workflows/collector.yml");
  const fallback = await source(".github/workflows/unified-data-capture.yml");
  for (const workflow of [collector, fallback]) {
    const defaultIndex = workflow.indexOf("required=true");
    const successIndex = workflow.indexOf('if [ "$status" = "200" ]');
    assert.ok(defaultIndex >= 0 && successIndex > defaultIndex);
  }
});
