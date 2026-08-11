import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildAdvancedSignalReadinessV1, ADVANCED_SIGNAL_READINESS_VERSION } from "../lib/advanced-signal-readiness-v1.mjs";

const NOW = Date.parse("2026-08-11T10:30:00.000Z");

function basePick(overrides = {}) {
  return {
    sportKey: "icehockey_nhl",
    modelFactoryV1: { outputs: [], rejectedModels: [] },
    ...overrides
  };
}

function xgModel(overrides = {}) {
  return {
    modelId: "nhl-xg-shadow-v1",
    dependenceGroup: "icehockey_nhl-expected-performance-family",
    signalLineageV1: {
      signalFamilies: ["expected-performance"],
      metrics: ["xg", "post-shot-xg", "goals-saved-above-expected"],
      lineageFingerprint: "a".repeat(64)
    },
    audit: { chronologySafe: true },
    performanceEvidenceV1: null,
    ...overrides
  };
}

function family(result, name) {
  return result.families.find((row) => row.family === name);
}

test("unconfigured analytics does not manufacture advanced-model readiness", () => {
  const result = buildAdvancedSignalReadinessV1(basePick(), {
    providerConfiguration: { configured: false, source: "external-sports-analytics", transport: "not-configured" },
    now: NOW
  });
  assert.equal(result.version, ADVANCED_SIGNAL_READINESS_VERSION);
  assert.equal(family(result, "expected-performance").status, "provider-not-configured");
  assert.equal(family(result, "expected-performance").probabilityModelPresent, false);
  assert.equal(result.contracts.rawAnalyticsAutomaticallyConvertedToProbability, false);
  assert.equal(result.contracts.providerConfiguredMeansModelReady, false);
});

test("configured raw analytics provider still requires an audited probability model", () => {
  const result = buildAdvancedSignalReadinessV1(basePick(), {
    providerConfiguration: { configured: true, source: "advanced-provider", transport: "https-post" },
    now: NOW
  });
  const row = family(result, "expected-performance");
  assert.equal(row.status, "provider-configured-model-missing");
  assert.equal(row.rawAnalyticsSourceConfigured, true);
  assert.equal(row.metricCoverage.observed, false);
  assert.equal(row.metricCoverage.rate, null);
  assert.match(row.nextRequirement, /supply-audited-deterministic/);
});

test("accepted xG shadow becomes model-ready but not review-ready without holdout", () => {
  const result = buildAdvancedSignalReadinessV1(basePick({
    modelFactoryV1: { outputs: [xgModel()], rejectedModels: [] }
  }), {
    providerConfiguration: { configured: true, source: "advanced-provider", transport: "https-post" },
    now: NOW
  });
  const row = family(result, "expected-performance");
  assert.equal(row.status, "shadow-model-needs-holdout");
  assert.equal(row.probabilityModelPresent, true);
  assert.equal(row.chronologyReady, true);
  assert.equal(row.lineageReady, true);
  assert.equal(row.metricCoverage.rate, 1);
  assert.equal(row.performanceEvidenceReady, false);
  assert.equal(result.counts.shadowModelReadyFamilies, 1);
  assert.equal(result.counts.reviewReadyFamilies, 0);
});

test("chronological calibration evidence makes the xG family review-ready but never production-eligible", () => {
  const result = buildAdvancedSignalReadinessV1(basePick({
    modelFactoryV1: {
      outputs: [xgModel({ performanceEvidenceV1: { calibrationReady: true } })],
      rejectedModels: []
    }
  }), {
    providerConfiguration: { configured: true, source: "advanced-provider", transport: "https-post" },
    now: NOW
  });
  const row = family(result, "expected-performance");
  assert.equal(row.status, "review-ready-shadow");
  assert.equal(row.performanceEvidenceReady, true);
  assert.equal(row.productionEligible, false);
  assert.equal(result.counts.reviewReadyFamilies, 1);
  assert.equal(result.contracts.automaticPromotionAllowed, false);
  assert.equal(result.contracts.productionProbabilityChanged, false);
});

test("rejected expected-performance output surfaces audit repair as the next step", () => {
  const result = buildAdvancedSignalReadinessV1(basePick({
    modelFactoryV1: {
      outputs: [],
      rejectedModels: [{
        modelId: "broken-xg-model",
        signalFamilies: ["expected-performance"],
        reasons: ["prediction-after-decision-horizon"]
      }]
    }
  }), {
    providerConfiguration: { configured: true, source: "advanced-provider", transport: "https-post" },
    now: NOW
  });
  const row = family(result, "expected-performance");
  assert.equal(row.status, "model-output-rejected");
  assert.deepEqual(row.rejectedModelIds, ["broken-xg-model"]);
  assert.equal(row.nextRequirement, "fix-model-lineage-chronology-or-audit-errors");
});

test("event readiness panel reuses the existing data audit response without fetching", () => {
  const client = fs.readFileSync(new URL("../app/event/[eventId]/EventDataAuditClient.jsx", import.meta.url), "utf8");
  const panel = fs.readFileSync(new URL("../app/event/[eventId]/EventAdvancedSignalReadinessPanel.jsx", import.meta.url), "utf8");
  const route = fs.readFileSync(new URL("../app/api/data-layer/route.js", import.meta.url), "utf8");
  assert.match(client, /EventAdvancedSignalReadinessPanel/);
  assert.equal(client.split("fetch(").length - 1, 1);
  assert.equal(panel.split("fetch(").length - 1, 0);
  assert.match(panel, /advancedSignalReadiness/);
  assert.match(route, /scorecaster-advanced-signal-readiness-v1/);
  assert.match(route, /rawAdvancedAnalyticsAutomaticallyCreateModelProbability: false/);
});
