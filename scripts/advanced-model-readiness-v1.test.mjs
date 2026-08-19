import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ADVANCED_MODEL_READINESS_POLICY,
  ADVANCED_MODEL_READINESS_VERSION,
  buildAdvancedModelReadinessV1,
  summarizeAdvancedModelReadinessSnapshotsV1
} from "../lib/advanced-model-readiness-v1.mjs";

function blockedNhlModel() {
  return {
    version: "nhl-xg-goalie-shadow-v1",
    modelId: "nhl-xg-goalie-poisson-v1",
    status: "unavailable",
    generatedAt: "2026-10-01T12:00:00.000Z",
    predictionHorizon: "2026-10-01T12:00:00.000Z",
    reasons: [
      "missing-home-xgf60",
      "missing-away-xga60",
      "missing-home-gsax60",
      "missing-away-gsax60"
    ],
    inputSummary: {
      eligibleAdvancedObservations: 2,
      usedObservations: 2,
      optionalPostShotXgPresent: false
    },
    provenance: { providers: ["licensed-hockey-data"], metrics: ["xg-for-per-60"] }
  };
}

function readyNhlModel() {
  return {
    ...blockedNhlModel(),
    status: "ready",
    reasons: [],
    inputSnapshotHash: "abc123",
    inputSummary: {
      eligibleAdvancedObservations: 8,
      usedObservations: 8,
      optionalPostShotXgPresent: true
    },
    provenance: {
      providers: ["licensed-hockey-data"],
      metrics: ["xg-for-per-60", "xg-against-per-60", "goals-saved-above-expected-per-60"]
    }
  };
}

test("NHL readiness records exact safe missing-input blockers without changing production", () => {
  const readiness = buildAdvancedModelReadinessV1({
    sport: "ice_hockey",
    models: { nhl: blockedNhlModel() },
    externalProvider: {
      configured: true,
      source: "licensed-hockey-data",
      mode: "live",
      ok: true,
      observationCount: 2
    }
  });

  assert.equal(readiness.version, ADVANCED_MODEL_READINESS_VERSION);
  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.modelId, "nhl-xg-goalie-poisson-v1");
  assert.deepEqual(readiness.blockers, [
    "missing-home-xgf60",
    "missing-away-xga60",
    "missing-home-gsax60",
    "missing-away-gsax60"
  ]);
  assert.equal(readiness.provider.mode, "live");
  assert.equal(readiness.inputSummary["eligibleadvancedobservations"], 2);
  assert.equal(readiness.holdoutCaptureReady, false);
  assert.equal(readiness.productionProbabilityChanged, false);
  assert.equal(readiness.productionDecisionChanged, false);
  assert.equal(readiness.automaticPromotionAllowed, false);
  assert.equal(readiness.paperOnly, true);
});

test("not-configured independent provider becomes an explicit fail-closed readiness blocker", () => {
  const readiness = buildAdvancedModelReadinessV1({
    sport: "ice_hockey",
    models: { nhl: blockedNhlModel() },
    externalProvider: {
      configured: false,
      source: "external-sports-analytics",
      mode: "not-configured",
      ok: false,
      observationCount: 0,
      reason: "SPORTS_ANALYTICS_API_KEY=do-not-retain"
    }
  });

  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.blockers.includes("external-provider-not-configured"));
  const serialized = JSON.stringify(readiness);
  assert.doesNotMatch(serialized, /do-not-retain|api[_-]?key/i);
});

test("ready advanced model can enter holdout collection but still cannot self-promote", () => {
  const readiness = buildAdvancedModelReadinessV1({
    sport: "ice_hockey",
    models: { nhl: readyNhlModel() },
    externalProvider: {
      configured: true,
      source: "licensed-hockey-data",
      mode: "live",
      ok: true,
      observationCount: 8
    }
  });

  assert.equal(readiness.status, "ready");
  assert.deepEqual(readiness.blockers, []);
  assert.equal(readiness.holdoutCaptureReady, true);
  assert.deepEqual(readiness.lineage.providers, ["licensed-hockey-data"]);
  assert.equal(readiness.automaticPromotionAllowed, false);
  assert.equal(readiness.productionProbabilityChanged, false);
});

test("collection summary uses only the latest readiness state per event and model", () => {
  const blocked = buildAdvancedModelReadinessV1({
    sport: "ice_hockey",
    models: { nhl: blockedNhlModel() },
    externalProvider: { configured: true, source: "licensed-hockey-data", mode: "live", ok: true, observationCount: 2 }
  });
  const ready = buildAdvancedModelReadinessV1({
    sport: "ice_hockey",
    models: { nhl: readyNhlModel() },
    externalProvider: { configured: true, source: "licensed-hockey-data", mode: "live", ok: true, observationCount: 8 }
  });
  const secondBlocked = buildAdvancedModelReadinessV1({
    sport: "ice_hockey",
    models: { nhl: { ...blockedNhlModel(), reasons: ["missing-away-gsax60"] } },
    externalProvider: { configured: false, source: "external-sports-analytics", mode: "not-configured", ok: false, observationCount: 0 }
  });

  const summary = summarizeAdvancedModelReadinessSnapshotsV1([
    { event_id: "nhl-1", captured_at: "2026-10-01T10:00:00.000Z", raw_summary: { advancedModelReadiness: blocked } },
    { event_id: "nhl-1", captured_at: "2026-10-01T12:00:00.000Z", raw_summary: { advancedModelReadiness: ready } },
    { event_id: "nhl-2", captured_at: "2026-10-02T12:00:00.000Z", raw_summary: { advancedModelReadiness: secondBlocked } }
  ]);

  assert.equal(summary.eventModelStates, 2);
  assert.equal(summary.readyEvents, 1);
  assert.equal(summary.blockedEvents, 1);
  assert.equal(summary.models.length, 1);
  assert.equal(summary.models[0].events, 2);
  assert.equal(summary.models[0].readyEvents, 1);
  assert.equal(summary.models[0].blockedEvents, 1);
  assert.equal(summary.models[0].holdoutCollectionStarted, true);
  assert.deepEqual(summary.topBlockers, [
    { reason: "external-provider-not-configured", count: 1 },
    { reason: "missing-away-gsax60", count: 1 }
  ]);
});

test("readiness policy never retains raw provider errors or credentials", () => {
  assert.equal(ADVANCED_MODEL_READINESS_POLICY.retainedRawProviderErrors, false);
  assert.equal(ADVANCED_MODEL_READINESS_POLICY.retainedCredentials, false);
  assert.equal(ADVANCED_MODEL_READINESS_POLICY.marketInputsAcceptedAsIndependentModelInputs, false);
  assert.equal(ADVANCED_MODEL_READINESS_POLICY.automaticPromotionAllowed, false);
  assert.equal(ADVANCED_MODEL_READINESS_POLICY.productionProbabilityChanged, false);
  assert.equal(ADVANCED_MODEL_READINESS_POLICY.paperOnly, true);
});

test("Sports Analytics capture, holdout service and Model Lab wire readiness without raw provider errors", async () => {
  const worker = await readFile(new URL("../app/api/internal/sports-analytics/route.js", import.meta.url), "utf8");
  const service = await readFile(new URL("../lib/advanced-model-holdout-service.js", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/model-holdout/route.js", import.meta.url), "utf8");
  const ui = await readFile(new URL("../app/model-lab/ModelHoldoutScorecard.jsx", import.meta.url), "utf8");

  assert.match(worker, /buildAdvancedModelReadinessV1/);
  assert.match(worker, /advancedModelReadinessVersion/);
  assert.match(worker, /advancedModelsReady/);
  assert.match(worker, /advancedModelsBlocked/);
  assert.match(service, /summarizeAdvancedModelReadinessSnapshotsV1/);
  assert.match(api, /advancedModelReadiness/);
  assert.match(ui, /Advanced Model Input Readiness V1/);
  assert.match(ui, /data-advanced-model-readiness-v1/);
  assert.doesNotMatch(worker, /advancedModelReadiness[\s\S]{0,800}reason:\s*external\.reason/);
});
