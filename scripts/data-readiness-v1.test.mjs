import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildProviderAcquisitionPlan, acquisitionForTarget } from "../lib/provider-acquisition-v1.mjs";
import { buildDataReadiness, DATA_READINESS_VERSION } from "../lib/data-readiness-v1.mjs";

const now = Date.parse("2026-08-23T08:30:00.000Z");

test("all football provider gaps belong to an explicit procurement bundle", () => {
  const plan = buildProviderAcquisitionPlan();
  assert.equal(plan.providerGapCount, 14);
  assert.equal(plan.providerCapableCount, 22);
  assert.equal(plan.unmappedTargetKeys.length, 0);
  assert.equal(plan.bundles.flatMap((bundle) => bundle.targets).length, 14);
  assert.equal(acquisitionForTarget("first_goal_team")?.priority, 1);
  assert.equal(plan.safety.inventedPricesAllowed, false);
  assert.equal(plan.safety.providerActivationRequiresWrittenRights, true);
});

test("healthy capture remains distinct from external provider and learning gaps", () => {
  const result = buildDataReadiness({
    marketCapture: {
      workerEnabled: true,
      snapshotCount: 33380,
      latestRun: { status: "partial", completed_at: "2026-08-23T08:00:00.000Z", event_count: 41, record_count: 1702 }
    },
    liveMonitor: {
      provider: { configured: false, contractReady: false, failedGates: ["endpointConfigured"] },
      snapshots24h: 0
    },
    shadowLearning: { settledCount: 42, clvCount: 18, reviewReadyCount: 0 }
  }, { now });
  assert.equal(result.version, DATA_READINESS_VERSION);
  assert.equal(result.marketCapture.status, "healthy");
  assert.equal(result.verifiedLiveMonitor.status, "provider-required");
  assert.equal(result.shadowLearning.status, "collecting-evidence");
  assert.equal(result.shadowLearning.settled.remaining, 258);
  assert.equal(result.shadowLearning.clv.remaining, 82);
  assert.equal(result.summary.providerGapMarkets, 14);
  assert.equal(result.safety.paperOnly, true);
  assert.equal(result.safety.syntheticMarketDataAllowed, false);
});

test("live readiness requires a contract-ready provider and fresh evidence", () => {
  const result = buildDataReadiness({
    marketCapture: { workerEnabled: true },
    liveMonitor: {
      provider: { configured: true, contractReady: true, failedGates: [] },
      snapshots24h: 10,
      latestSnapshot: { captured_at: "2026-08-23T08:28:00.000Z" }
    },
    shadowLearning: { settledCount: 300, clvCount: 100, reviewReadyCount: 1 }
  }, { now });
  assert.equal(result.verifiedLiveMonitor.status, "healthy");
  assert.equal(result.shadowLearning.status, "review-ready");
  assert.equal(result.shadowLearning.automaticPromotion, false);
});

test("data-readiness API and UI expose aggregate state without secrets or real-money actions", async () => {
  const [route, client, liveProvider] = await Promise.all([
    readFile(new URL("../app/api/data-readiness/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/data-readiness/DataReadinessClient.jsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/live-monitor-json-provider.js", import.meta.url), "utf8")
  ]);
  assert.match(route, /personalDataReturned: false/);
  assert.match(route, /secretsReturned: false/);
  assert.match(route, /paperOnly: true/);
  assert.match(route, /"Cache-Control": "no-store, max-age=0"/);
  assert.match(client, /synthetic|Puuttuva data|Missing data/i);
  assert.match(client, /Automatic promotion remains disabled/);
  assert.match(liveProvider, /LIVE_MONITOR_LIVE_DATA_ALLOWED/);
  assert.match(liveProvider, /LIVE_MONITOR_DISPLAY_ALLOWED/);
  assert.match(liveProvider, /contractReferenceConfigured/);
  assert.doesNotMatch(client, /deposit|real-money bet|bookmaker redirect/i);
});
