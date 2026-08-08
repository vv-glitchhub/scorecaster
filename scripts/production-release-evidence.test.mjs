import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildProductionReleaseEvidence,
  PRODUCTION_RELEASE_EVIDENCE_VERSION,
  runtimeDeploymentEvidence
} from "../lib/production-release-evidence.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const manifest = {
  product: "Scorecaster",
  productionBaseUrl: "https://scorecaster.vercel.app",
  supabaseMigrations: ["supabase/one.sql", "supabase/two.sql"],
  productionPatches: ["scripts/patch-one.sql"],
  manualReleaseChecks: [
    { id: "two-user-isolation", title: "Two-user RLS isolation", blocking: true },
    { id: "physical-push", title: "Physical push", blocking: true }
  ],
  internalWorkers: [
    { path: "/api/internal/collector", method: "GET", allowedStatuses: [401, 503] },
    { path: "/api/internal/settlement-monitor", method: "GET", allowedStatuses: [401, 503] }
  ]
};

function readyProductionEvidence() {
  return {
    version: "scorecaster-production-evidence-v1",
    generatedAt: "2026-08-07T14:00:00.000Z",
    windowDays: 30,
    releaseState: "ready",
    ready: true,
    blockers: [],
    summary: {
      leagues: 1,
      enabledLeagues: 1,
      degradedLeagues: 0,
      disabledLeagues: 0,
      events: 20,
      verifiedFixtureIdentityRate: 1,
      multiProviderEventRate: 1,
      closingEligibleEvents: 20,
      closingEvents: 18,
      closingLineCoverage: 0.9,
      providerCount: 2,
      averageProviderAvailability: 0.97,
      activeIncidents: 0
    },
    worker: {
      state: "enabled",
      observedCycles: 24,
      cycles: 24,
      denominator: 24,
      successRate: 0.96,
      latestAt: "2026-08-07T13:55:00.000Z",
      latestAgeMinutes: 5
    },
    leagues: [{
      sport: "soccer_epl",
      league: "epl",
      state: "enabled",
      score: 92,
      events: 20,
      verifiedIdentityRate: 1,
      multiProviderRate: 1,
      closingLineCoverage: 0.9,
      latestAgeMinutes: 5,
      reasons: [],
      denominators: { identity: 20, multiProvider: 20, closingLine: 20 }
    }]
  };
}

function verifiedMigrationEvidence() {
  return {
    status: "passed",
    observedAt: "2026-08-07T13:40:00.000Z",
    configuredMigrationCount: 2,
    recordedMigrationCount: 2,
    verifiedAppliedCount: 2,
    unverifiedCount: 0,
    unresolvedCount: 0,
    orderMatchesManifest: true,
    validationPassed: true,
    productionVerified: true,
    registrySchemaVersion: 1,
    statusFingerprint: "a".repeat(64),
    validationFailureCount: 0
  };
}

const productionDeployment = {
  source: "runtime-metadata",
  environment: "production",
  commitSha: "a209e77b91c16a98ea6ab8b9994ce89f60accc63",
  host: "scorecaster.vercel.app",
  deploymentObserved: true,
  productionRuntimeObserved: true
};

test("runtime deployment evidence exposes only bounded deployment metadata", () => {
  const result = runtimeDeploymentEvidence({
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_SHA: "a209e77b91c16a98ea6ab8b9994ce89f60accc63",
    VERCEL_PROJECT_PRODUCTION_URL: "https://scorecaster.vercel.app/",
    SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-key",
    CRON_SECRET: "super-secret-cron"
  });

  assert.equal(result.environment, "production");
  assert.equal(result.commitSha, "a209e77b91c16a98ea6ab8b9994ce89f60accc63");
  assert.equal(result.host, "scorecaster.vercel.app");
  assert.equal(result.productionRuntimeObserved, true);
  assert.doesNotMatch(JSON.stringify(result), /super-secret|service-role|cron/i);
});

test("a healthy runtime report still fails closed when release proof is unverified", () => {
  const artifact = buildProductionReleaseEvidence({
    productionEvidence: readyProductionEvidence(),
    manifest,
    deployment: productionDeployment
  });

  assert.equal(artifact.version, PRODUCTION_RELEASE_EVIDENCE_VERSION);
  assert.equal(artifact.activationEligible, false);
  assert.ok(artifact.blockers.includes("production-migrations-unverified"));
  assert.ok(artifact.blockers.includes("protected-worker-probes-unverified"));
  assert.ok(artifact.blockers.includes("manual-release-gates-unverified"));
  assert.equal(artifact.productionEvidence.summary.closingLineCoverage, 0.9);
  assert.deepEqual(artifact.productionEvidence.leagues[0].denominators, { identity: 20, multiProvider: 20, closingLine: 20 });
  assert.equal(artifact.migrationInventory.migrationCount, 2);
  assert.equal(artifact.migrationInventory.configuredMigrationCount, 2);
  assert.equal(artifact.migrationInventory.recordedMigrationCount, null);
  assert.equal(artifact.migrationInventory.productionVerified, false);
  assert.equal(artifact.migrationInventory.latestMigration, "supabase/two.sql");
  assert.equal(artifact.migrationInventory.migrationsFingerprint.length, 64);
  assert.equal(artifact.manifestFingerprint.length, 64);
  assert.equal(artifact.artifactId.length, 64);
  assert.ok(artifact.manualGates.every((gate) => gate.status === "unverified"));
  assert.ok(artifact.protectedWorkerProbes.every((probe) => probe.status === "unverified"));
  assert.equal(artifact.safety.migrationFilePresenceUsedAsProductionProof, false);
  assert.equal(artifact.safety.rawMigrationEvidenceRefsIncluded, false);
  assert.equal(artifact.safety.missingEvidenceImputed, false);
});

test("status passed alone cannot certify migrations without productionVerified evidence", () => {
  const artifact = buildProductionReleaseEvidence({
    productionEvidence: readyProductionEvidence(),
    manifest,
    deployment: productionDeployment,
    migrationEvidence: { status: "passed", productionVerified: false },
    manualGateEvidence: Object.fromEntries(manifest.manualReleaseChecks.map((gate) => [gate.id, { status: "passed" }])),
    workerProbeEvidence: Object.fromEntries(manifest.internalWorkers.map((worker) => [worker.path, { status: "passed", httpStatus: 401 }]))
  });

  assert.equal(artifact.activationEligible, false);
  assert.equal(artifact.evidenceSummary.migrationsVerified, false);
  assert.ok(artifact.blockers.includes("production-migrations-unverified"));
});

test("the artifact becomes activation-eligible only when every external gate is explicitly passed", () => {
  const artifact = buildProductionReleaseEvidence({
    productionEvidence: readyProductionEvidence(),
    manifest,
    deployment: productionDeployment,
    migrationEvidence: verifiedMigrationEvidence(),
    manualGateEvidence: {
      "two-user-isolation": { status: "passed", evidenceRef: "release-evidence/rls.json" },
      "physical-push": { status: "passed", evidenceRef: "release-evidence/push.json" }
    },
    workerProbeEvidence: {
      "/api/internal/collector": { status: "passed", httpStatus: 401, evidenceRef: "release-evidence/workers.json" },
      "/api/internal/settlement-monitor": { status: "passed", httpStatus: 401, evidenceRef: "release-evidence/workers.json" }
    }
  });

  assert.equal(artifact.activationEligible, true);
  assert.deepEqual(artifact.blockers, []);
  assert.equal(artifact.evidenceSummary.productionEvidenceReady, true);
  assert.equal(artifact.evidenceSummary.deploymentVerified, true);
  assert.equal(artifact.evidenceSummary.migrationsVerified, true);
  assert.equal(artifact.evidenceSummary.runtimeWorkerEnabled, true);
  assert.equal(artifact.evidenceSummary.protectedWorkerProbesPassed, true);
  assert.equal(artifact.evidenceSummary.manualBlockingGatesPassed, true);
  assert.equal(artifact.migrationInventory.verifiedAppliedCount, 2);
  assert.equal(artifact.migrationInventory.unresolvedCount, 0);
  assert.equal(artifact.migrationInventory.statusFingerprint, "a".repeat(64));
});

test("production evidence failure remains a hard blocker even if other evidence is passed", () => {
  const report = readyProductionEvidence();
  report.releaseState = "blocked";
  report.ready = false;
  report.blockers = ["provider-evidence-missing"];
  report.worker.state = "disabled";

  const artifact = buildProductionReleaseEvidence({
    productionEvidence: report,
    manifest,
    deployment: productionDeployment,
    migrationEvidence: verifiedMigrationEvidence(),
    manualGateEvidence: Object.fromEntries(manifest.manualReleaseChecks.map((gate) => [gate.id, { status: "passed" }])),
    workerProbeEvidence: Object.fromEntries(manifest.internalWorkers.map((worker) => [worker.path, { status: "passed", httpStatus: 401 }]))
  });

  assert.equal(artifact.activationEligible, false);
  assert.ok(artifact.blockers.includes("production-evidence-blocked"));
  assert.ok(artifact.blockers.includes("runtime-worker-evidence-below-target"));
  assert.equal(artifact.productionEvidence.blockers[0], "provider-evidence-missing");
});

test("missing numeric evidence stays null instead of becoming an invented zero", () => {
  const report = readyProductionEvidence();
  report.summary.averageProviderAvailability = null;
  report.summary.closingLineCoverage = null;
  report.leagues[0].closingLineCoverage = null;
  report.leagues[0].denominators.closingLine = null;

  const artifact = buildProductionReleaseEvidence({
    productionEvidence: report,
    manifest,
    deployment: productionDeployment
  });

  assert.equal(artifact.productionEvidence.summary.averageProviderAvailability, null);
  assert.equal(artifact.productionEvidence.summary.closingLineCoverage, null);
  assert.equal(artifact.productionEvidence.leagues[0].closingLineCoverage, null);
  assert.equal(artifact.productionEvidence.leagues[0].denominators.closingLine, null);
  assert.equal(artifact.safety.missingEvidenceImputed, false);
});

test("artifact identity is deterministic for the same evidence package", () => {
  const input = {
    productionEvidence: readyProductionEvidence(),
    manifest,
    deployment: productionDeployment,
    migrationEvidence: { status: "unverified", productionVerified: false }
  };
  const one = buildProductionReleaseEvidence(input);
  const two = buildProductionReleaseEvidence(input);
  assert.equal(one.artifactId, two.artifactId);
  assert.equal(one.manifestFingerprint, two.manifestFingerprint);
});

test("public production-evidence API derives migration, cache and worker proof from canonical trusted registries, not query parameters", async () => {
  const route = await source("app/api/production-evidence/route.js");
  assert.match(route, /production-migration-status\.json/);
  assert.match(route, /buildMigrationReleaseStatus/);
  assert.match(route, /statusDocument:\s*productionMigrationStatus/);
  assert.match(route, /production-manual-gate-evidence\.json/);
  assert.match(route, /buildTrustedLiveDataCacheGateEvidence/);
  assert.match(route, /trustedDocument:\s*productionManualGateEvidence/);
  assert.match(route, /implementation:\s*liveDataCacheImplementation/);
  assert.match(route, /policy:\s*liveDataCachePolicy/);
  assert.match(route, /production-worker-probe-evidence\.json/);
  assert.match(route, /protected-worker-implementation\.json/);
  assert.match(route, /buildTrustedProtectedWorkerProbeEvidence/);
  assert.match(route, /trustedDocument:\s*productionWorkerProbeEvidence/);
  assert.match(route, /implementation:\s*protectedWorkerImplementation/);
  assert.match(route, /buildProductionReleaseEvidence/);
  assert.match(route, /runtimeDeploymentEvidence\(process\.env\)/);
  assert.match(route, /new Set\(\["json", "csv", "release"\]\)/);
  assert.match(route, /filename="scorecaster-release-evidence-/);
  assert.match(route, /migrationEvidence,/);
  assert.match(route, /manualGateEvidence:\s*retainedCacheEvidence\.manualGateEvidence/);
  assert.match(route, /workerProbeEvidence:\s*retainedWorkerEvidence\.workerProbeEvidence/);
  assert.doesNotMatch(route, /manualGateEvidence.*searchParams|workerProbeEvidence.*searchParams|migrationEvidence.*searchParams|productionVerified.*searchParams|gateStatus.*searchParams|workerStatus.*searchParams/s);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|ODDS_API_KEY|x-apikey/i);
});
