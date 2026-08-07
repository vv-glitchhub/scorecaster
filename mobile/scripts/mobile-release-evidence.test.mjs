import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));

function run(script, args = [], env = {}) {
  return spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8"
  });
}

test("physical device matrix covers both platforms and FI EN ES without fabricating completion", async () => {
  const matrix = await json("store/physical-device-test-matrix.json");
  assert.deepEqual(matrix.requiredPlatforms, ["ios", "android"]);
  assert.deepEqual(matrix.requiredLocales, ["fi", "en", "es"]);
  assert.equal(matrix.matrix.length, 6);
  const keys = new Set(matrix.matrix.map((item) => `${item.platform}:${item.locale}`));
  for (const platform of matrix.requiredPlatforms) {
    for (const locale of matrix.requiredLocales) assert.ok(keys.has(`${platform}:${locale}`));
  }
  assert.ok(matrix.criticalFlows.includes("account-export"));
  assert.ok(matrix.criticalFlows.includes("account-deletion-on-disposable-account"));
  assert.ok(matrix.criticalFlows.includes("expired-session-fail-closed"));
  assert.ok(matrix.notificationChecks.includes("cold-start-notification-deep-link"));
  assert.equal(matrix.evidenceRules.rawAccessTokensAllowed, false);
  assert.equal(matrix.evidenceRules.pushTokensAllowed, false);
  assert.ok(matrix.matrix.every((item) => item.status === "pending"));
  assert.ok(matrix.matrix.every((item) => item.buildReference === null));
});

test("signed bundle audit is fail-honest when no physical artifact is supplied", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "scorecaster-mobile-audit-"));
  const report = path.join(temp, "report.json");
  try {
    const result = run("signed-bundle-audit.mjs", ["--report", report]);
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(await readFile(report, "utf8"));
    assert.equal(data.status, "unverified");
    assert.equal(data.artifactsProvided, 0);
    assert.equal(data.bothPlatformsPassed, false);
    assert.equal(data.safety.secretValuesIncludedInReport, false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("signed bundle audit passes a clean extracted JS bundle and rejects a forbidden public server alias", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "scorecaster-mobile-bundle-"));
  const cleanDir = path.join(temp, "clean.ipa");
  const badDir = path.join(temp, "bad.apk");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(cleanDir, { recursive: true });
  await mkdir(badDir, { recursive: true });
  try {
    await writeFile(path.join(cleanDir, "main.jsbundle"), "const api='https://scorecaster.vercel.app'; const mode='paper-only';\n");
    const cleanReport = path.join(temp, "clean.json");
    const clean = run("signed-bundle-audit.mjs", ["--artifact", cleanDir, "--report", cleanReport, "--require-artifact"]);
    assert.equal(clean.status, 0, clean.stderr);
    const cleanData = JSON.parse(await readFile(cleanReport, "utf8"));
    assert.equal(cleanData.artifactReports[0].passed, true);

    const forbiddenName = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
    const forbiddenAlias = ["EXPO", "PUBLIC", forbiddenName].join("_");
    await writeFile(path.join(badDir, "main.jsbundle"), `const leakedName='${forbiddenAlias}';\n`);
    const badReport = path.join(temp, "bad.json");
    const bad = run("signed-bundle-audit.mjs", ["--artifact", badDir, "--report", badReport, "--require-artifact"]);
    assert.notEqual(bad.status, 0);
    const badData = JSON.parse(await readFile(badReport, "utf8"));
    assert.equal(badData.status, "failed");
    assert.ok(badData.artifactReports[0].violations.some((item) => item.type === "forbidden-public-server-secret-alias"));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("mobile evidence aggregator stays unverified until signed builds and device evidence exist", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "scorecaster-mobile-evidence-"));
  const report = path.join(temp, "mobile-evidence.json");
  try {
    const result = run("mobile-release-evidence.mjs", ["--repository-audit-passed"], {
      MOBILE_RELEASE_EVIDENCE_REPORT_PATH: report
    });
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(await readFile(report, "utf8"));
    assert.equal(data.status, "repository-ready-external-evidence-required");
    assert.equal(data.gates.repositoryReady, true);
    assert.equal(data.gates.signedBundlesComplete, false);
    assert.equal(data.gates.deviceMatrixComplete, false);
    assert.equal(data.gates.internalBetaEvidenceComplete, false);
    assert.equal(data.gates.publicStoreSubmissionAllowed, false);
    assert.equal(data.releaseEvidenceFragment.status, "unverified");
    assert.equal(data.safety.serverSecretValuesIncluded, false);
    assert.equal(data.safety.realMoneyExecution, false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("repository release blockers keep account, signing, production isolation and physical testing external", async () => {
  const blockers = await json("store/release-blockers.json");
  const ids = new Set(blockers.externalBlockers.map((item) => item.id));
  for (const id of [
    "apple-developer-membership",
    "google-play-console",
    "expo-eas-project",
    "production-cloud-isolation",
    "native-auth-redirect",
    "store-assets",
    "real-device-accessibility",
    "external-security-review"
  ]) assert.ok(ids.has(id));
  assert.ok(blockers.externalBlockers.filter((item) => item.required).every((item) => item.completed === false));
});
