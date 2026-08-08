import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildTrustedProtectedWorkerProbeEvidence } from "../lib/protected-worker-production-evidence.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const read = async (path) => readFile(resolve(root, path), "utf8");
const json = async (path) => JSON.parse(await read(path));
const clone = (value) => structuredClone(value);

const manifest = await json("config/release-readiness.json");
const implementation = await json("config/protected-worker-implementation.json");
const trustedDocument = await json("config/production-worker-probe-evidence.json");

test("protected worker implementation fingerprint is recomputed from current manifest and route sources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "scorecaster-worker-contract-"));
  const reportPath = join(directory, "report.json");
  try {
    const run = spawnSync(process.execPath, ["scripts/protected-worker-contract-audit.mjs"], {
      cwd: root,
      env: { ...process.env, PROTECTED_WORKER_CONTRACT_REPORT_PATH: reportPath },
      encoding: "utf8"
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.version, implementation.contractVersion);
    assert.equal(report.passed, true);
    assert.equal(report.workerCount, implementation.workerCount);
    assert.equal(report.implementationFingerprint, implementation.implementationFingerprint);
    assert.equal(report.workers.every((worker) => worker.passed), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reviewed production probes pass only for the exact current protected worker contract", () => {
  const result = buildTrustedProtectedWorkerProbeEvidence({ trustedDocument, implementation, manifest });
  assert.equal(result.ok, true);
  assert.equal(result.status, "passed");
  assert.equal(result.workerCount, 9);
  assert.equal(result.passedWorkerCount, 9);
  assert.equal(Object.values(result.workerProbeEvidence).every((entry) => entry.status === "passed"), true);
  assert.equal(result.probes.every((probe) => probe.httpStatus === 401), true);
  assert.equal(result.evidenceBoundary.cronSecretSent, false);
  assert.equal(result.evidenceBoundary.authorizationCredentialSent, false);
});

test("stale implementation fingerprint invalidates every retained worker probe", () => {
  const stale = clone(trustedDocument);
  stale.implementationFingerprint = "0".repeat(64);
  const result = buildTrustedProtectedWorkerProbeEvidence({ trustedDocument: stale, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("worker-production-evidence-stale"));
  assert.equal(Object.values(result.workerProbeEvidence).every((entry) => entry.status === "unverified"), true);
});

test("missing, duplicate and extra worker probes fail closed", () => {
  const missing = clone(trustedDocument);
  missing.probes.pop();
  let result = buildTrustedProtectedWorkerProbeEvidence({ trustedDocument: missing, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("missing-worker-probe")));

  const duplicate = clone(trustedDocument);
  duplicate.probes[8] = clone(duplicate.probes[0]);
  result = buildTrustedProtectedWorkerProbeEvidence({ trustedDocument: duplicate, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("duplicate-worker-probe")));

  const extra = clone(trustedDocument);
  extra.probes.push({ ...clone(extra.probes[0]), path: "/api/internal/not-declared" });
  result = buildTrustedProtectedWorkerProbeEvidence({ trustedDocument: extra, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("unexpected-worker-path")));
});

test("unexpected status, missing numeric metadata, cache replay or credential use fail closed", () => {
  const badStatus = clone(trustedDocument);
  badStatus.probes[0].httpStatus = 200;
  let result = buildTrustedProtectedWorkerProbeEvidence({ trustedDocument: badStatus, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("worker-http-status-not-allowed")));

  const missingAge = clone(trustedDocument);
  delete missingAge.probes[0].ageSeconds;
  result = buildTrustedProtectedWorkerProbeEvidence({ trustedDocument: missingAge, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("worker-probe-age-not-zero")));

  const cached = clone(trustedDocument);
  cached.probes[0].vercelCache = "HIT";
  result = buildTrustedProtectedWorkerProbeEvidence({ trustedDocument: cached, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("worker-probe-cache-state-forbidden")));

  const credentialed = clone(trustedDocument);
  credentialed.cronSecretSent = true;
  result = buildTrustedProtectedWorkerProbeEvidence({ trustedDocument: credentialed, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("cron-secret-must-not-be-sent"));
});

test("secret-bearing evidence references and retained secret-shaped content fail the evidence boundary", () => {
  const secretRef = clone(trustedDocument);
  secretRef.evidenceRef = "https://example.invalid/evidence?token=secret";
  const result = buildTrustedProtectedWorkerProbeEvidence({ trustedDocument: secretRef, implementation, manifest });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("worker-evidence-reference-invalid-or-secret-bearing"));

  const serialized = JSON.stringify(trustedDocument);
  assert.doesNotMatch(serialized, /authorization\s*[:=]|bearer\s|service[_-]?role|api[_-]?key|password/i);
  assert.equal(trustedDocument.cronSecretSent, false);
  assert.equal(trustedDocument.authorizationCredentialSent, false);
  assert.equal(trustedDocument.rawResponseBodyIncluded, false);
  assert.equal(trustedDocument.secretValuesIncluded, false);
});

test("release route obtains worker proof only from repository-maintained trusted evidence", async () => {
  const route = await read("app/api/production-evidence/route.js");
  assert.match(route, /production-worker-probe-evidence\.json/);
  assert.match(route, /protected-worker-implementation\.json/);
  assert.match(route, /buildTrustedProtectedWorkerProbeEvidence/);
  assert.match(route, /trustedDocument:\s*productionWorkerProbeEvidence/);
  assert.match(route, /implementation:\s*protectedWorkerImplementation/);
  assert.match(route, /workerProbeEvidence:\s*retainedWorkerEvidence\.workerProbeEvidence/);
  assert.doesNotMatch(route, /workerProbeEvidence.*searchParams|workerStatus.*searchParams|cronSecret.*searchParams/s);
});
