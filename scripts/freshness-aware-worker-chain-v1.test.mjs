import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateUnifiedCaptureFreshness,
  normalizeFreshSkipMinutes,
  UNIFIED_CAPTURE_FRESHNESS_POLICY
} from "../lib/unified-capture-freshness-v1.mjs";

const NOW = Date.parse("2026-08-15T04:30:00Z");

test("freshness threshold skips strictly younger captures but captures exactly at the boundary", () => {
  const fresh = evaluateUnifiedCaptureFreshness({
    latestCapturedAt: new Date(NOW - 14.9 * 60_000).toISOString(),
    now: NOW,
    thresholdMinutes: 15
  });
  const boundary = evaluateUnifiedCaptureFreshness({
    latestCapturedAt: new Date(NOW - 15 * 60_000).toISOString(),
    now: NOW,
    thresholdMinutes: 15
  });

  assert.equal(fresh.fresh, true);
  assert.equal(fresh.providerRequestsAllowed, false);
  assert.equal(boundary.fresh, false);
  assert.equal(boundary.providerRequestsAllowed, true);
});

test("freshness input is bounded and missing capture never blocks acquisition", () => {
  assert.equal(normalizeFreshSkipMinutes(null), 0);
  assert.equal(normalizeFreshSkipMinutes(""), 0);
  assert.equal(normalizeFreshSkipMinutes(-2), 0);
  assert.equal(normalizeFreshSkipMinutes(15.9), 15);
  assert.equal(normalizeFreshSkipMinutes(999), 20);

  const missing = evaluateUnifiedCaptureFreshness({ latestCapturedAt: null, now: NOW, thresholdMinutes: 15 });
  assert.equal(missing.fresh, false);
  assert.equal(missing.providerRequestsAllowed, true);
  assert.equal(missing.latestCapturedAt, null);
  assert.equal(UNIFIED_CAPTURE_FRESHNESS_POLICY.paperOnly, true);
});

test("protected Unified Data route checks freshness before Top Picks/provider acquisition", async () => {
  const route = await readFile(new URL("../app/api/internal/unified-data/route.js", import.meta.url), "utf8");
  const authIndex = route.indexOf("authorized(request)");
  const freshnessIndex = route.indexOf("latestCaptureFreshness(admin, now, freshSkipMinutes)");
  const skipIndex = route.indexOf("providerRequestsMade: false");
  const topPicksIndex = route.indexOf("fetch(`${origin}/api/top-picks`");

  assert.ok(authIndex >= 0);
  assert.ok(freshnessIndex > authIndex);
  assert.ok(skipIndex > freshnessIndex);
  assert.ok(topPicksIndex > skipIndex);
  assert.match(route, /unified-sports-data-worker-v4/);
  assert.match(route, /reason: "fresh-capture"/);
  assert.match(route, /paperOnly: true/);
});

test("Collector chains Unified Data and analytics while fallback schedule remains freshness-aware", async () => {
  const collector = await readFile(new URL("../.github/workflows/collector.yml", import.meta.url), "utf8");
  const fallback = await readFile(new URL("../.github/workflows/unified-data-capture.yml", import.meta.url), "utf8");

  for (const workflow of [collector, fallback]) {
    assert.match(workflow, /group: scorecaster-data-pipeline/);
    assert.match(workflow, /skipIfFreshMinutes=15/);
    assert.match(workflow, /steps\.unified\.outputs\.skipped != 'true'/);
    assert.match(workflow, /\/api\/internal\/sports-analytics/);
    assert.match(workflow, /-o \/tmp\/unified\.json/);
    assert.match(workflow, /jq -r '\.ok \/\/ false'/);
    assert.doesNotMatch(workflow, /cat \/tmp\/unified\.json/);
  }

  const collectIndex = collector.indexOf("/api/internal/collector");
  const unifiedIndex = collector.indexOf("/api/internal/unified-data?skipIfFreshMinutes=15");
  const analyticsIndex = collector.indexOf("/api/internal/sports-analytics");
  assert.ok(collectIndex >= 0 && unifiedIndex > collectIndex && analyticsIndex > unifiedIndex);
  assert.match(fallback, /cron: "17,47 \* \* \* \*"/);
});

test("worker chain never changes product safety boundaries", async () => {
  const route = await readFile(new URL("../app/api/internal/unified-data/route.js", import.meta.url), "utf8");
  const collector = await readFile(new URL("../.github/workflows/collector.yml", import.meta.url), "utf8");
  assert.match(route, /paperOnly: true/);
  assert.doesNotMatch(route, /realMoney|bookmakerLogin|payment|deposit|withdraw/i);
  assert.doesNotMatch(collector, /bookmaker|deposit|withdraw|payment/i);
});
