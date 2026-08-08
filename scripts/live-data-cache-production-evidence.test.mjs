import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTrustedLiveDataCacheGateEvidence } from "../lib/live-data-cache-production-evidence.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const read = async (path) => readFile(resolve(root, path), "utf8");
const json = async (path) => JSON.parse(await read(path));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const clone = (value) => structuredClone(value);

const policy = await json("config/live-data-cache-boundary.json");
const implementation = await json("config/live-data-cache-implementation.json");
const trustedDocument = await json("config/production-manual-gate-evidence.json");

async function recomputeImplementation() {
  const policyFingerprint = sha256(JSON.stringify(policy));
  const files = [];
  for (const entry of implementation.files) {
    files.push({ path: entry.path, sha256: sha256(await read(entry.path)) });
  }
  return {
    policyFingerprint,
    files,
    implementationFingerprint: sha256(JSON.stringify({ policyFingerprint, files }))
  };
}

test("cache implementation manifest is bound to the actual cache-relevant sources", async () => {
  const current = await recomputeImplementation();
  assert.equal(current.policyFingerprint, implementation.policyFingerprint);
  assert.deepEqual(current.files, implementation.files);
  assert.equal(current.implementationFingerprint, implementation.implementationFingerprint);
});

test("reviewed double production probe passes only for the current implementation", () => {
  const result = buildTrustedLiveDataCacheGateEvidence({ trustedDocument, implementation, policy });
  assert.equal(result.ok, true);
  assert.equal(result.status, "passed");
  assert.equal(result.probeCount, 2);
  assert.equal(result.verifiedDeployment.environment, "production");
  assert.equal(result.verifiedDeployment.host, "scorecaster.vercel.app");
  assert.equal(result.manualGateEvidence["live-data-pwa-cache-boundary"].status, "passed");
  assert.equal(result.evidenceBoundary.secretValuesIncluded, false);
  assert.equal(result.evidenceBoundary.rawResponseBodyIncluded, false);
});

test("release API obtains cache gate state only from repository-maintained trusted evidence", async () => {
  const route = await read("app/api/production-evidence/route.js");
  assert.match(route, /productionManualGateEvidence/);
  assert.match(route, /buildTrustedLiveDataCacheGateEvidence/);
  assert.match(route, /manualGateEvidence:\s*retainedCacheEvidence\.manualGateEvidence/);
  assert.doesNotMatch(route, /searchParams\.get\(["'](?:manualGateEvidence|gateStatus|productionVerified|cacheGate)["']\)/);
  assert.match(route, /const allowed = new Set\(\[["']days["'], ["']sport["'], ["']format["']\]\)/);
});

test("stale implementation fingerprint invalidates retained production evidence", () => {
  const stale = clone(trustedDocument);
  stale.gates["live-data-pwa-cache-boundary"].implementationFingerprint = "0".repeat(64);
  const result = buildTrustedLiveDataCacheGateEvidence({ trustedDocument: stale, implementation, policy });
  assert.equal(result.ok, false);
  assert.equal(result.status, "unverified");
  assert.ok(result.failures.includes("production-evidence-stale-for-current-cache-implementation"));
});

test("one probe cannot self-certify a production cache boundary", () => {
  const oneProbe = clone(trustedDocument);
  oneProbe.gates["live-data-pwa-cache-boundary"].probes = oneProbe.gates["live-data-pwa-cache-boundary"].probes.slice(0, 1);
  const result = buildTrustedLiveDataCacheGateEvidence({ trustedDocument: oneProbe, implementation, policy });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("at-least-two-production-probes-required"));
});

test("HIT or STALE response cache states fail closed", () => {
  for (const state of ["HIT", "STALE"]) {
    const tampered = clone(trustedDocument);
    tampered.gates["live-data-pwa-cache-boundary"].probes[1].vercelCache = state;
    const result = buildTrustedLiveDataCacheGateEvidence({ trustedDocument: tampered, implementation, policy });
    assert.equal(result.ok, false);
    assert.ok(result.failures.includes(`probe-vercel-cache-forbidden:${state}`));
  }
});

test("missing no-store or nonzero Age fails closed", () => {
  const missingNoStore = clone(trustedDocument);
  missingNoStore.gates["live-data-pwa-cache-boundary"].probes[0].cacheControl = "public, max-age=60";
  let result = buildTrustedLiveDataCacheGateEvidence({ trustedDocument: missingNoStore, implementation, policy });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("probe-cache-control-missing:no-store"));

  const aged = clone(trustedDocument);
  aged.gates["live-data-pwa-cache-boundary"].probes[0].ageSeconds = 1;
  result = buildTrustedLiveDataCacheGateEvidence({ trustedDocument: aged, implementation, policy });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("probe-age-above-maximum"));
});

test("retained evidence contains no raw body, secrets, user IDs or provider payloads", () => {
  const serialized = JSON.stringify(trustedDocument);
  assert.doesNotMatch(serialized, /authorization|bearer\s|service[_-]?role|api[_-]?key|password/i);
  const gate = trustedDocument.gates["live-data-pwa-cache-boundary"];
  assert.equal(gate.rawResponseBodyIncluded, false);
  assert.equal(gate.secretValuesIncluded, false);
  assert.equal(gate.userIdentifiersIncluded, false);
  assert.equal(gate.providerPayloadsIncluded, false);
});
