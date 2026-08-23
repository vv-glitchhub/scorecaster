import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildTrustedProtectedApiProbeEvidence } from "../lib/protected-api-production-evidence.mjs";
import { buildProductionReleaseEvidence } from "../lib/production-release-evidence.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const read = async (path) => readFile(resolve(root, path), "utf8");
const json = async (path) => JSON.parse(await read(path));
const clone = (value) => structuredClone(value);

const manifest = await json("config/release-readiness.json");
const implementation = await json("config/protected-api-implementation.json");
const trustedDocument = await json("config/production-protected-api-probe-evidence.json");

test("protected API implementation fingerprint is recomputed from the current manifest and route sources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "scorecaster-protected-api-contract-"));
  const reportPath = join(directory, "report.json");
  try {
    const run = spawnSync(process.execPath, ["scripts/protected-api-contract-audit.mjs"], {
      cwd: root,
      env: { ...process.env, PROTECTED_API_CONTRACT_REPORT_PATH: reportPath },
      encoding: "utf8"
    });
    assert.equal(run.status, 0, `${run.stderr || ""}\n${run.stdout || ""}`);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.version, implementation.contractVersion);
    assert.equal(report.passed, true);
    assert.equal(report.apiCount, implementation.apiCount);
    assert.equal(report.passedApis, implementation.apiCount);
    assert.equal(report.implementationFingerprint, implementation.implementationFingerprint);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reviewed 13-route production auth probe passes only for the exact current implementation", () => {
  const result = buildTrustedProtectedApiProbeEvidence({ trustedDocument, implementation, manifest });
  const exactContract = trustedDocument.implementationFingerprint === implementation.implementationFingerprint;
  if (exactContract) {
    assert.equal(result.ok, true);
    assert.equal(result.status, "passed");
    assert.equal(result.passedApiCount, implementation.apiCount);
    assert.equal(result.probes.every((probe) => probe.httpStatus === 401), true);
    assert.equal(Object.values(result.protectedApiProbeEvidence).every((entry) => entry.status === "passed"), true);
  } else {
    assert.equal(result.ok, false);
    assert.equal(result.status, "unverified");
    assert.equal(result.passedApiCount, 0);
    assert.ok(result.failures.includes("protected-api-production-evidence-stale"));
    assert.equal(Object.values(result.protectedApiProbeEvidence).every((entry) => entry.status === "unverified"), true);
  }
  assert.equal(result.apiCount, implementation.apiCount);
  assert.equal(result.evidenceBoundary.sessionCredentialSent, false);
  assert.equal(result.evidenceBoundary.bearerTokenSent, false);
  assert.equal(result.evidenceBoundary.userDataIncluded, false);
});

test("stale fingerprint invalidates every retained protected API probe", () => {
  const stale = clone(trustedDocument);
  stale.implementationFingerprint = "0".repeat(64);
  const result = buildTrustedProtectedApiProbeEvidence({ trustedDocument: stale, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("protected-api-production-evidence-stale"));
  assert.equal(Object.values(result.protectedApiProbeEvidence).every((entry) => entry.status === "unverified"), true);
});

test("missing, duplicate and extra protected API routes fail closed", () => {
  const missing = clone(trustedDocument);
  missing.probes.pop();
  let result = buildTrustedProtectedApiProbeEvidence({ trustedDocument: missing, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("missing-protected-api-probe")));

  const duplicate = clone(trustedDocument);
  duplicate.probes[11] = clone(duplicate.probes[0]);
  result = buildTrustedProtectedApiProbeEvidence({ trustedDocument: duplicate, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("duplicate-protected-api-probe")));

  const extra = clone(trustedDocument);
  extra.probes.push({ ...clone(extra.probes[0]), path: "/api/cloud/not-declared" });
  result = buildTrustedProtectedApiProbeEvidence({ trustedDocument: extra, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("unexpected-protected-api-path")));
});

test("200 response, missing Age, cache replay or credential use fail closed", () => {
  const badStatus = clone(trustedDocument);
  badStatus.probes[0].httpStatus = 200;
  let result = buildTrustedProtectedApiProbeEvidence({ trustedDocument: badStatus, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("protected-api-http-status-not-allowed")));

  const missingAge = clone(trustedDocument);
  delete missingAge.probes[0].ageSeconds;
  result = buildTrustedProtectedApiProbeEvidence({ trustedDocument: missingAge, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("protected-api-age-not-zero")));

  const cached = clone(trustedDocument);
  cached.probes[0].vercelCache = "STALE";
  result = buildTrustedProtectedApiProbeEvidence({ trustedDocument: cached, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("protected-api-cache-state-forbidden")));

  const credentialed = clone(trustedDocument);
  credentialed.bearerTokenSent = true;
  result = buildTrustedProtectedApiProbeEvidence({ trustedDocument: credentialed, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("bearer-token-must-not-be-sent"));
});

test("secret-bearing evidence references and retained user/security material fail the evidence boundary", () => {
  const secretRef = clone(trustedDocument);
  secretRef.evidenceRef = "https://example.invalid/probe?token=secret";
  let result = buildTrustedProtectedApiProbeEvidence({ trustedDocument: secretRef, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("protected-api-evidence-reference-invalid-or-secret-bearing"));

  const userData = clone(trustedDocument);
  userData.userDataIncluded = true;
  result = buildTrustedProtectedApiProbeEvidence({ trustedDocument: userData, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("protected-api-user-data-must-not-be-retained"));

  const serialized = JSON.stringify(trustedDocument);
  assert.doesNotMatch(serialized, /authorization\s*[:=]|bearer\s|service[_ -]?role|api[_ -]?key|password|cookie=/i);
});

test("canonical release artifact blocks declared protected APIs without evidence and clears only with trusted 13/13 evidence", () => {
  const miniManifest = {
    product: "Scorecaster",
    productionBaseUrl: "https://scorecaster.vercel.app",
    protectedApis: manifest.protectedApis,
    internalWorkers: [],
    manualReleaseChecks: [],
    supabaseMigrations: [],
    productionPatches: []
  };
  const base = {
    productionEvidence: {
      version: "test",
      generatedAt: "2026-08-08T18:00:24.000Z",
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
  assert.ok(missing.blockers.includes("protected-api-probes-unverified"));
  assert.equal(missing.evidenceSummary.protectedApiProbesPassed, false);

  const exactDocument = { ...trustedDocument, implementationFingerprint: implementation.implementationFingerprint };
  const trusted = buildTrustedProtectedApiProbeEvidence({ trustedDocument: exactDocument, implementation, manifest });
  assert.equal(trusted.ok, true);
  const passed = buildProductionReleaseEvidence({ ...base, protectedApiProbeEvidence: trusted.protectedApiProbeEvidence });
  assert.ok(!passed.blockers.includes("protected-api-probes-unverified"));
  assert.equal(passed.evidenceSummary.protectedApiProbesPassed, true);
  assert.equal(passed.protectedApiProbes.length, implementation.apiCount);
  assert.equal(passed.protectedApiProbes.every((probe) => probe.status === "passed"), true);
});

test("release route obtains protected API proof only from repository-maintained trusted evidence", async () => {
  const route = await read("app/api/production-evidence/route.js");
  assert.match(route, /production-protected-api-probe-evidence\.json/);
  assert.match(route, /protected-api-implementation\.json/);
  assert.match(route, /buildTrustedProtectedApiProbeEvidence/);
  assert.match(route, /trustedDocument:\s*productionProtectedApiProbeEvidence/);
  assert.match(route, /implementation:\s*protectedApiImplementation/);
  assert.match(route, /protectedApiProbeEvidence:\s*retainedProtectedApiEvidence\.protectedApiProbeEvidence/);
  assert.doesNotMatch(route, /protectedApiProbeEvidence.*searchParams|protectedApiStatus.*searchParams|bearerToken.*searchParams|sessionCredential.*searchParams/s);
});
