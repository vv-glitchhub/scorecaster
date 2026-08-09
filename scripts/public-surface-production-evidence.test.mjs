import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildTrustedPublicSurfaceEvidence } from "../lib/public-surface-production-evidence.mjs";
import { buildProductionReleaseEvidence } from "../lib/production-release-evidence.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const read = async (path) => readFile(resolve(root, path), "utf8");
const json = async (path) => JSON.parse(await read(path));
const clone = (value) => structuredClone(value);

const manifest = await json("config/release-readiness.json");
const implementation = await json("config/public-surface-implementation.json");
const trustedDocument = await json("config/production-public-surface-evidence.json");
const retainedEvidenceIsCurrent = trustedDocument.implementationFingerprint === implementation.implementationFingerprint;
const reviewedFixture = { ...clone(trustedDocument), implementationFingerprint: implementation.implementationFingerprint };

test("public surface implementation fingerprint is recomputed from current pages, headers and Next config", async () => {
  const directory = await mkdtemp(join(tmpdir(), "scorecaster-public-surface-contract-"));
  const reportPath = join(directory, "report.json");
  try {
    const run = spawnSync(process.execPath, ["scripts/public-surface-contract-audit.mjs"], {
      cwd: root,
      env: { ...process.env, PUBLIC_SURFACE_CONTRACT_REPORT_PATH: reportPath },
      encoding: "utf8"
    });
    assert.equal(run.status, 0, `${run.stderr || ""}\n${run.stdout || ""}`);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.version, implementation.contractVersion);
    assert.equal(report.passed, true);
    assert.equal(report.pageCount, implementation.pageCount);
    assert.equal(report.resolvedPageCount, implementation.pageCount);
    assert.equal(report.requiredSecurityHeaderCount, implementation.requiredSecurityHeaderCount);
    assert.equal(report.implementationFingerprint, implementation.implementationFingerprint);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("repository retained public evidence is either current or explicitly fails closed as stale", () => {
  const result = buildTrustedPublicSurfaceEvidence({ trustedDocument, implementation, manifest });
  if (retainedEvidenceIsCurrent) {
    assert.equal(result.ok, true);
    assert.equal(result.status, "passed");
    assert.equal(result.pageCount, 15);
    assert.equal(result.passedPageCount, 15);
    assert.equal(Object.values(result.publicSurfaceEvidence).every((entry) => entry.status === "passed"), true);
  } else {
    assert.equal(result.ok, false);
    assert.equal(result.status, "unverified");
    assert.ok(result.failures.includes("public-surface-production-evidence-stale"));
    assert.equal(Object.values(result.publicSurfaceEvidence).every((entry) => entry.status === "unverified"), true);
  }
});

test("a fingerprint-aligned reviewed fixture validates all 15 pages and five required headers", () => {
  const result = buildTrustedPublicSurfaceEvidence({ trustedDocument: reviewedFixture, implementation, manifest });
  assert.equal(result.ok, true);
  assert.equal(result.status, "passed");
  assert.equal(result.pageCount, 15);
  assert.equal(result.passedPageCount, 15);
  assert.equal(result.requiredSecurityHeaderCount, 5);
  assert.equal(Object.values(result.publicSurfaceEvidence).every((entry) => entry.status === "passed"), true);
  assert.equal(result.probes.every((probe) => probe.httpStatus === 200), true);
  assert.equal(result.probes.every((probe) => probe.contentType.startsWith("text/html")), true);
  assert.equal(result.evidenceBoundary.pageBodyRead, false);
  assert.equal(result.evidenceBoundary.pageBodyRetained, false);
  assert.equal(result.evidenceBoundary.credentialsSent, false);
});

test("stale public surface implementation invalidates every retained page probe", () => {
  const stale = clone(reviewedFixture);
  stale.implementationFingerprint = "0".repeat(64);
  const result = buildTrustedPublicSurfaceEvidence({ trustedDocument: stale, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("public-surface-production-evidence-stale"));
  assert.equal(Object.values(result.publicSurfaceEvidence).every((entry) => entry.status === "unverified"), true);
});

test("missing, duplicate and extra public pages fail closed", () => {
  const missing = clone(reviewedFixture);
  missing.probes.pop();
  let result = buildTrustedPublicSurfaceEvidence({ trustedDocument: missing, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("missing-public-page-probe")));

  const duplicate = clone(reviewedFixture);
  duplicate.probes[14] = clone(duplicate.probes[0]);
  result = buildTrustedPublicSurfaceEvidence({ trustedDocument: duplicate, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("duplicate-public-page-probe")));

  const extra = clone(reviewedFixture);
  extra.probes.push({ ...clone(extra.probes[0]), path: "/not-declared" });
  result = buildTrustedPublicSurfaceEvidence({ trustedDocument: extra, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("unexpected-public-page")));
});

test("404, wrong security header, missing Age and STALE cache state fail closed", () => {
  const missingPage = clone(reviewedFixture);
  missingPage.probes[0].httpStatus = 404;
  let result = buildTrustedPublicSurfaceEvidence({ trustedDocument: missingPage, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("public-page-http-status-not-200")));

  const wrongHeader = clone(reviewedFixture);
  wrongHeader.probes[0].requiredSecurityHeaders["x-frame-options"] = "SAMEORIGIN";
  result = buildTrustedPublicSurfaceEvidence({ trustedDocument: wrongHeader, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("public-page-header-mismatch:x-frame-options")));

  const missingAge = clone(reviewedFixture);
  delete missingAge.probes[0].ageSeconds;
  result = buildTrustedPublicSurfaceEvidence({ trustedDocument: missingAge, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("public-page-age-invalid")));

  const staleCache = clone(reviewedFixture);
  staleCache.probes[0].vercelCache = "STALE";
  result = buildTrustedPublicSurfaceEvidence({ trustedDocument: staleCache, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("public-page-cache-state-stale")));
});

test("HIT and PRERENDER are valid public-page cache states when headers and status are correct", () => {
  const result = buildTrustedPublicSurfaceEvidence({ trustedDocument: reviewedFixture, implementation, manifest });
  assert.equal(result.ok, true);
  assert.ok(result.probes.some((probe) => probe.vercelCache === "HIT"));
  assert.ok(result.probes.some((probe) => probe.vercelCache === "PRERENDER"));
});

test("secret-bearing refs, retained body or user data fail the evidence boundary", () => {
  const secretRef = clone(reviewedFixture);
  secretRef.evidenceRef = "https://example.invalid/evidence?token=secret";
  let result = buildTrustedPublicSurfaceEvidence({ trustedDocument: secretRef, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("public-surface-evidence-reference-invalid-or-secret-bearing"));

  const retainedBody = clone(reviewedFixture);
  retainedBody.pageBodyRetained = true;
  result = buildTrustedPublicSurfaceEvidence({ trustedDocument: retainedBody, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("public-surface-pageBodyRetained-must-be-false"));

  const retainedUserData = clone(reviewedFixture);
  retainedUserData.userDataRetained = true;
  result = buildTrustedPublicSurfaceEvidence({ trustedDocument: retainedUserData, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("public-surface-userDataRetained-must-be-false"));

  const serialized = JSON.stringify(trustedDocument);
  assert.doesNotMatch(serialized, /authorization\s*[:=]|bearer\s|service[_ -]?role|api[_ -]?key|password|cookie=/i);
});

test("canonical release artifact remains blocked while repository public-surface evidence is stale", () => {
  if (retainedEvidenceIsCurrent) return;
  const retained = buildTrustedPublicSurfaceEvidence({ trustedDocument, implementation, manifest });
  assert.equal(retained.ok, false);
  const artifact = buildProductionReleaseEvidence({
    productionEvidence: {
      version: "test",
      generatedAt: "2026-08-08T18:23:28.050Z",
      releaseState: "ready",
      ready: true,
      blockers: [],
      worker: { state: "enabled", observedCycles: 1, cycles: 1, denominator: 1, successRate: 1 }
    },
    manifest: {
      product: "Scorecaster",
      productionBaseUrl: "https://scorecaster.vercel.app",
      publicPages: manifest.publicPages,
      requiredSecurityHeaders: manifest.requiredSecurityHeaders,
      protectedApis: [],
      internalWorkers: [],
      manualReleaseChecks: [],
      supabaseMigrations: [],
      productionPatches: []
    },
    deployment: {
      source: "runtime-metadata",
      environment: "production",
      commitSha: "51918b2d35a564178dcc814be3d53d651d4f5828",
      host: "scorecaster.vercel.app",
      deploymentObserved: true,
      productionRuntimeObserved: true
    },
    migrationEvidence: { status: "passed", productionVerified: true },
    publicSurfaceEvidence: retained.publicSurfaceEvidence
  });
  assert.equal(artifact.activationEligible, false);
  assert.ok(artifact.blockers.includes("public-surface-probes-unverified"));
});

test("canonical release artifact clears public page blocker only with structurally trusted 15/15 evidence", () => {
  const miniManifest = {
    product: "Scorecaster",
    productionBaseUrl: "https://scorecaster.vercel.app",
    publicPages: manifest.publicPages,
    requiredSecurityHeaders: manifest.requiredSecurityHeaders,
    protectedApis: [],
    internalWorkers: [],
    manualReleaseChecks: [],
    supabaseMigrations: [],
    productionPatches: []
  };
  const base = {
    productionEvidence: {
      version: "test",
      generatedAt: "2026-08-08T18:23:28.050Z",
      releaseState: "ready",
      ready: true,
      blockers: [],
      worker: { state: "enabled", observedCycles: 1, cycles: 1, denominator: 1, successRate: 1 }
    },
    manifest: miniManifest,
    deployment: {
      source: "runtime-metadata",
      environment: "production",
      commitSha: "51918b2d35a564178dcc814be3d53d651d4f5828",
      host: "scorecaster.vercel.app",
      deploymentObserved: true,
      productionRuntimeObserved: true
    },
    migrationEvidence: { status: "passed", productionVerified: true }
  };

  const missing = buildProductionReleaseEvidence(base);
  assert.equal(missing.activationEligible, false);
  assert.ok(missing.blockers.includes("public-surface-probes-unverified"));
  assert.equal(missing.evidenceSummary.publicSurfaceProbesPassed, false);

  const trusted = buildTrustedPublicSurfaceEvidence({ trustedDocument: reviewedFixture, implementation, manifest });
  assert.equal(trusted.ok, true);
  const passed = buildProductionReleaseEvidence({ ...base, publicSurfaceEvidence: trusted.publicSurfaceEvidence });
  assert.ok(!passed.blockers.includes("public-surface-probes-unverified"));
  assert.equal(passed.evidenceSummary.publicSurfaceProbesPassed, true);
  assert.equal(passed.publicSurfaceProbes.length, 15);
  assert.equal(passed.publicSurfaceProbes.every((probe) => probe.status === "passed"), true);
});

test("release route obtains public surface proof only from repository-maintained trusted evidence", async () => {
  const route = await read("app/api/production-evidence/route.js");
  assert.match(route, /production-public-surface-evidence\.json/);
  assert.match(route, /public-surface-implementation\.json/);
  assert.match(route, /buildTrustedPublicSurfaceEvidence/);
  assert.match(route, /trustedDocument:\s*productionPublicSurfaceEvidence/);
  assert.match(route, /implementation:\s*publicSurfaceImplementation/);
  assert.match(route, /publicSurfaceEvidence:\s*retainedPublicSurfaceEvidence\.publicSurfaceEvidence/);
  assert.doesNotMatch(route, /publicSurfaceEvidence.*searchParams|publicSurfaceStatus.*searchParams|securityHeaders.*searchParams/s);
});
