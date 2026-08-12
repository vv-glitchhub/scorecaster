import test from "node:test";
import assert from "node:assert/strict";
import { buildAdvancedProviderQualificationV1, REQUIRED_PROVIDER_CONTRACT } from "../lib/advanced-provider-qualification-v1.mjs";

const NOW = Date.parse("2026-08-12T12:00:00.000Z");

function provider(overrides = {}) {
  return {
    configured: true,
    source: "licensed-advanced-provider",
    transport: "https-post",
    contract: REQUIRED_PROVIDER_CONTRACT,
    ...overrides
  };
}

function admittedOutput() {
  return {
    modelId: "soccer-xg-poisson-v1",
    dependenceGroup: "soccer_epl-expected-performance-family",
    signalLineageV1: { signalFamilies: ["expected-performance"] },
    audit: { chronologySafe: true, inputSnapshotHash: "abc123" }
  };
}

function pick(overrides = {}) {
  return {
    commenceTime: "2026-08-12T13:00:00.000Z",
    advancedShadowInputStatus: {
      ok: true,
      sport: "soccer",
      mode: "stored-pregame-advanced",
      providerCount: 1,
      newestObservedAt: "2026-08-12T11:30:00.000Z",
      horizon: "2026-08-12T12:00:00.000Z"
    },
    modelFactoryV1: { outputs: [admittedOutput()] },
    ...overrides
  };
}

test("provider not configured fails closed", () => {
  const report = buildAdvancedProviderQualificationV1(pick(), { providerConfiguration: { configured: false }, now: NOW });
  assert.equal(report.shadowQualified, false);
  assert.equal(report.stage, "provider-not-configured");
  assert.ok(report.reasons.includes("advanced-provider-not-configured"));
});

test("configuration alone never qualifies a provider", () => {
  const p = pick({ advancedShadowInputStatus: { ok: false, providerCount: 0, mode: "no-independent-advanced-data" }, modelFactoryV1: { outputs: [] } });
  const report = buildAdvancedProviderQualificationV1(p, { providerConfiguration: provider(), now: NOW });
  assert.equal(report.shadowQualified, false);
  assert.equal(report.stage, "configured-no-independent-data");
  assert.ok(report.reasons.includes("no-independent-advanced-data"));
  assert.ok(report.reasons.includes("no-audited-advanced-model-output"));
  assert.equal(report.contract.providerConfiguredDoesNotMeanModelReady, true);
});

test("wrong provider contract is rejected even when data and model output exist", () => {
  const report = buildAdvancedProviderQualificationV1(pick(), { providerConfiguration: provider({ contract: "scorecaster-sports-analytics-v4" }), now: NOW });
  assert.equal(report.shadowQualified, false);
  assert.equal(report.stage, "provider-contract-incompatible");
  assert.ok(report.reasons.includes("advanced-provider-contract-incompatible"));
});

test("fresh independent data plus audited chronology-safe model output qualifies for shadow holdout only", () => {
  const report = buildAdvancedProviderQualificationV1(pick(), { providerConfiguration: provider(), now: NOW });
  assert.equal(report.shadowQualified, true);
  assert.equal(report.holdoutCaptureEligible, true);
  assert.equal(report.stage, "qualified-for-shadow-holdout");
  assert.equal(report.productionEligible, false);
  assert.equal(report.contract.automaticPromotionAllowed, false);
});

test("stale or undated advanced data is blocked", () => {
  const p = pick();
  p.advancedShadowInputStatus.newestObservedAt = "2026-08-01T00:00:00.000Z";
  const report = buildAdvancedProviderQualificationV1(p, { providerConfiguration: provider(), now: NOW });
  assert.equal(report.shadowQualified, false);
  assert.ok(report.reasons.includes("advanced-data-operationally-stale-or-undated"));
});
