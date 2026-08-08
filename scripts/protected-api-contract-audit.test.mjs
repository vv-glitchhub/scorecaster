import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));

test("every declared protected API has a static fail-closed auth contract and deterministic fingerprint", async () => {
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
    assert.equal(report.version, "scorecaster-protected-api-contract-v1");
    assert.equal(report.apiCount, 12);
    assert.equal(report.passedApis, 12);
    assert.equal(report.failedApis, 0);
    assert.equal(report.passed, true);
    assert.match(report.implementationFingerprint, /^[0-9a-f]{64}$/);
    assert.equal(report.apis.every((api) => api.passed), true);
    assert.equal(report.safety.sessionCredentialRead, false);
    assert.equal(report.safety.bearerTokenRead, false);
    assert.equal(report.safety.protectedApiInvoked, false);
    console.log(`Protected API implementation fingerprint: ${report.implementationFingerprint}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
