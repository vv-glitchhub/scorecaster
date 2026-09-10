import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAcceptanceValidationV1, ACCEPTANCE_VALIDATION_VERSION } from "../lib/acceptance-validation-v1.mjs";

const healthy = {
  health: {
    app: "Scorecaster",
    status: "ok",
    deployment: "production",
    commit: "abc123",
    services: {
      supabaseConfigured: true,
      oddsApiConfigured: true,
      realMoneyBetting: false,
      lineupProviderConfigured: false
    },
    marketUniverse: {
      unavailableLeagues: [{ key: "icehockey_finland_liiga" }]
    }
  },
  intelligence: {
    ok: true,
    storage: {
      shadowPredictions: 77069,
      ownBaselinePredictions: 50000,
      selfTrainedMlPredictions: 27069,
      verifiedFinalOutcomes: 21714,
      learningExamples: 0,
      trainingEligibleExamples: 0
    },
    contracts: {
      paperOnly: true,
      realMoneyActionAvailable: false
    },
    modelGovernance: {
      automaticPromotionAllowed: false
    }
  },
  calibration: {
    storageAvailable: true,
    eligibleObservationCount: 0,
    exclusionCount: 0
  },
  control: {
    readiness: {
      blockers: ["calibration-sample-below-300", "closing-line-history-missing"]
    }
  },
  operations: null
};

test("unloaded state is checking, never code-blocked or zero-filled", () => {
  const result = buildAcceptanceValidationV1();
  assert.equal(result.overallStatus, "checking");
  assert.equal(result.evidenceStage, "checking");
  assert.equal(result.codeReady, false);
  assert.equal(result.evidenceReady, false);
  assert.equal(result.metrics.modelPredictions, null);
  assert.equal(result.metrics.verifiedFinalOutcomes, null);
  assert.equal(result.externalChecks.find((item) => item.id === "lineups")?.status, "unknown");
  assert.equal(result.externalChecks.find((item) => item.id === "liiga-provider")?.status, "unknown");
  assert.ok(result.codeChecks.every((item) => item.status === "unknown"));
});

test("current-like production state is code-ready but collecting real evidence", () => {
  const result = buildAcceptanceValidationV1(healthy);
  assert.equal(result.version, ACCEPTANCE_VALIDATION_VERSION);
  assert.equal(result.codeReady, true);
  assert.equal(result.evidenceReady, false);
  assert.equal(result.evidenceStage, "collecting-first-evidence");
  assert.equal(result.overallStatus, "collecting-evidence");
  assert.equal(result.metrics.modelPredictions, 77069);
  assert.equal(result.metrics.verifiedFinalOutcomes, 21714);
  assert.equal(result.metrics.learningExamples, 0);
  assert.equal(result.metrics.calibrationObservations, 0);
});

test("evidence does not become review-ready before both chronology and paper samples meet policy", () => {
  const almost = structuredClone(healthy);
  almost.intelligence.storage.learningExamples = 100;
  almost.intelligence.storage.trainingEligibleExamples = 100;
  almost.calibration.eligibleObservationCount = 99;
  let result = buildAcceptanceValidationV1(almost);
  assert.equal(result.evidenceReady, false);
  assert.equal(result.evidenceStage, "growing-sample");

  almost.calibration.eligibleObservationCount = 100;
  result = buildAcceptanceValidationV1(almost);
  assert.equal(result.evidenceReady, true);
  assert.equal(result.evidenceStage, "review-sample-ready");
  assert.equal(result.overallStatus, "external-acceptance-pending");
});

test("paper-only and no-auto-promotion are hard code readiness gates", () => {
  const unsafe = structuredClone(healthy);
  unsafe.health.services.realMoneyBetting = true;
  unsafe.intelligence.modelGovernance.automaticPromotionAllowed = true;
  const result = buildAcceptanceValidationV1(unsafe);
  assert.equal(result.codeReady, false);
  assert.equal(result.overallStatus, "code-blocked");
  assert.equal(result.codeChecks.find((item) => item.id === "paper-boundary")?.status, "blocked");
  assert.equal(result.codeChecks.find((item) => item.id === "automatic-promotion")?.status, "blocked");
});

test("external evidence stays explicit and Liiga provider gap is not hidden", () => {
  const result = buildAcceptanceValidationV1(healthy);
  assert.equal(result.externalChecks.find((item) => item.id === "leaked-password-protection")?.status, "external");
  assert.equal(result.externalChecks.find((item) => item.id === "physical-push")?.status, "auth-required");
  assert.equal(result.externalChecks.find((item) => item.id === "lineups")?.status, "optional-gap");
  assert.equal(result.externalChecks.find((item) => item.id === "liiga-provider")?.status, "provider-gap");
});

test("dashboard is discoverable, honest while loading and model holdout remains manual", async () => {
  const client = await readFile(new URL("../app/acceptance-validation/AcceptanceValidationClient.jsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/acceptance-validation/page.jsx", import.meta.url), "utf8");
  const release = await readFile(new URL("../app/release-readiness/page.jsx", import.meta.url), "utf8");

  assert.match(client, /data-acceptance-validation-v1="true"/);
  assert.match(client, /CHECKING LIVE STATE/);
  assert.match(client, /value=\{checking \? "…"/);
  assert.match(client, /value === null \|\| value === undefined \|\| value === ""/);
  assert.match(client, /fetch\("\/api\/health"/);
  assert.match(client, /fetch\("\/api\/intelligence-core\/health"/);
  assert.match(client, /fetch\("\/api\/calibration\/health"/);
  assert.match(client, /fetch\("\/api\/production-control-center\?hours=24&limit=5000"/);
  assert.match(client, /fetch\("\/api\/model-holdout\?days=180"/);
  assert.match(client, /onClick=\{\(\) => void loadHoldout\(\)\}/);
  assert.match(client, /Historical outperformance does not guarantee future returns/);
  assert.match(page, /title: "Acceptance & Validation"/);
  assert.match(page, /AcceptanceValidationClient/);
  assert.match(release, /href="\/acceptance-validation"/);
});

test("release readiness never renders unloaded live checks as 0 or pending", async () => {
  const client = await readFile(new URL("../app/release-readiness/ReleaseReadinessClient.jsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/release-readiness/page.jsx", import.meta.url), "utf8");

  assert.match(client, /data-release-readiness-v1="true"/);
  assert.match(client, /value=\{loading \? "…"/);
  assert.match(client, /ready: healthKnown \?/);
  assert.match(client, /TARKISTETAAN/);
  assert.match(client, /KIRJAUDU JATKAAKSESI/);
  assert.match(client, /knownChecks\.length/);
  assert.doesNotMatch(page, /title: "Release Readiness \| Scorecaster"/);
  assert.match(page, /title: "Release Readiness"/);
});
