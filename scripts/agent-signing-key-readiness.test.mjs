import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  AGENT_SIGNING_KEY_GENERATED_BYTES,
  AGENT_SIGNING_KEY_MINIMUM_LENGTH,
  assessAgentDecisionSigningKey,
  generateAgentDecisionSigningKey
} from "../lib/agent-signing-key-readiness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const syntheticKey = "synthetic-agent-signing-key-for-ci-only-0123456789abcdef";

test("CSPRNG generator returns distinct sufficiently long URL-safe keys", () => {
  const first = generateAgentDecisionSigningKey();
  const second = generateAgentDecisionSigningKey();

  assert.notEqual(first, second);
  assert.ok(first.length >= AGENT_SIGNING_KEY_MINIMUM_LENGTH);
  assert.ok(second.length >= AGENT_SIGNING_KEY_MINIMUM_LENGTH);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
  assert.match(second, /^[A-Za-z0-9_-]+$/);
  assert.equal(AGENT_SIGNING_KEY_GENERATED_BYTES, 48);
});

test("short or missing key fails closed without fingerprint evidence", () => {
  for (const key of ["", "short-key"]) {
    const result = assessAgentDecisionSigningKey(key);
    assert.equal(result.configured, false);
    assert.equal(result.minimumLengthMet, false);
    assert.equal(result.fingerprintPrefix, null);
    assert.equal(result.roundTripPassed, false);
    assert.equal(result.wrongKeyRejected, false);
    assert.equal(result.secretValueIncluded, false);
    assert.equal(result.productionActivationPerformed, false);
  }
});

test("valid synthetic key passes ticket round trip while keeping report redacted", () => {
  const result = assessAgentDecisionSigningKey(syntheticKey);
  assert.equal(result.configured, true);
  assert.equal(result.minimumLengthMet, true);
  assert.equal(result.roundTripPassed, true);
  assert.equal(result.wrongKeyRejected, true);
  assert.match(result.fingerprintPrefix, /^[0-9a-f]{12}$/);

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, new RegExp(syntheticKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(Object.hasOwn(result, "key"), false);
  assert.equal(Object.hasOwn(result, "secret"), false);
});

test("verification CLI accepts a synthetic environment key but never prints it", () => {
  const run = spawnSync(process.execPath, ["scripts/verify-agent-decision-signing-key.mjs", "--require-present"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, AGENT_DECISION_SIGNING_KEY: syntheticKey }
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(run.stdout);
  assert.equal(report.passed, true);
  assert.equal(report.source, "environment");
  assert.equal(report.configured, true);
  assert.equal(report.roundTripPassed, true);
  assert.equal(report.wrongKeyRejected, true);
  assert.equal(report.secretValueIncluded, false);
  assert.doesNotMatch(run.stdout, new RegExp(syntheticKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("verification CLI fails closed when the environment key is absent", () => {
  const env = { ...process.env };
  delete env.AGENT_DECISION_SIGNING_KEY;
  const run = spawnSync(process.execPath, ["scripts/verify-agent-decision-signing-key.mjs", "--require-present"], {
    cwd: root,
    encoding: "utf8",
    env
  });
  assert.notEqual(run.status, 0);
  const report = JSON.parse(run.stdout);
  assert.equal(report.passed, false);
  assert.equal(report.configured, false);
  assert.equal(report.fingerprintPrefix, null);
});

test("generator refuses to create production-style secret material in CI", () => {
  const run = spawnSync(process.execPath, ["scripts/generate-agent-decision-signing-key.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CI: "true" }
  });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Refusing to generate an Agent decision signing key in CI/);
  assert.equal(run.stdout, "");
});

test("local secret handoff directory ignores generated values", async () => {
  const ignore = await readFile(resolve(root, ".scorecaster-secrets/.gitignore"), "utf8");
  assert.match(ignore, /^\*$/m);
  assert.match(ignore, /^!\.gitignore$/m);
});
