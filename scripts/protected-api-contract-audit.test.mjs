import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const implementation = JSON.parse(await readFile(resolve(root, "config/protected-api-implementation.json"), "utf8"));

test("every declared protected API has a static fail-closed auth contract and reviewed deterministic fingerprint", async () => {
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
    assert.equal(report.apiCount, implementation.apiCount);
    assert.equal(report.passedApis, implementation.apiCount);
    assert.equal(report.failedApis, 0);
    assert.equal(report.passed, true);
    assert.equal(report.implementationFingerprint, implementation.implementationFingerprint);
    assert.equal(report.apis.every((api) => api.passed), true);
    assert.equal(report.safety.sessionCredentialRead, false);
    assert.equal(report.safety.bearerTokenRead, false);
    assert.equal(report.safety.protectedApiInvoked, false);
    console.log(`Protected API implementation fingerprint: ${report.implementationFingerprint}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

await import("./protected-api-production-evidence.test.mjs");
