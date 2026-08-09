import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  describeVercelBuildPolicy,
  shouldIgnoreVercelBuild,
  vercelIgnoreCommandExitCode
} from "../lib/vercel-build-policy-v1.mjs";

function runIgnoreCommand(environment) {
  const env = { ...process.env };
  if (environment === undefined) delete env.VERCEL_ENV;
  else env.VERCEL_ENV = environment;
  return spawnSync(process.execPath, ["scripts/vercel-ignore-build.mjs"], {
    cwd: new URL("..", import.meta.url),
    env,
    encoding: "utf8"
  });
}

test("preview environment is ignored with Vercel exit code zero", () => {
  assert.equal(shouldIgnoreVercelBuild("preview"), true);
  assert.equal(vercelIgnoreCommandExitCode("preview"), 0);
  const result = runIgnoreCommand("preview");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /environment=preview action=skip-preview-build/);
});

test("production environment always continues automatic build", () => {
  assert.equal(shouldIgnoreVercelBuild("production"), false);
  assert.equal(vercelIgnoreCommandExitCode("production"), 1);
  const result = runIgnoreCommand("production");
  assert.equal(result.status, 1);
  assert.match(result.stdout, /environment=production action=continue-build/);
});

test("unknown or missing environment fails safely toward building", () => {
  for (const environment of [undefined, "", "development", "something-new"]) {
    assert.equal(shouldIgnoreVercelBuild(environment), false);
    assert.equal(vercelIgnoreCommandExitCode(environment), 1);
    const result = runIgnoreCommand(environment);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /action=continue-build/);
  }
});

test("policy description never treats unknown environment as a skipped build", () => {
  const policy = describeVercelBuildPolicy(undefined);
  assert.equal(policy.environment, "unknown");
  assert.equal(policy.ignored, false);
  assert.equal(policy.unknownEnvironmentFailsTowardBuild, true);
  assert.equal(policy.productionAutoDeployPreserved, false);
});
