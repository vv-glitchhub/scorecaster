import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = () => readFile(new URL("./post-deploy-unified-data-capture.mjs", import.meta.url), "utf8");

test("post-deploy capture is locked to the canonical production host and full commit SHA", async () => {
  const script = await source();
  assert.match(script, /parsedBase\.host !== "scorecaster\.vercel\.app"/);
  assert.match(script, /\^\[a-f0-9\]\{40\}\$/);
  assert.match(script, /observedCommit === targetSha/);
  assert.match(script, /worker was not invoked/);
});

test("protected worker invocation happens only after production commit confirmation", async () => {
  const script = await source();
  const guardIndex = script.indexOf("if (!productionMatchedAt)");
  const workerIndex = script.indexOf("/api/internal/unified-data");
  assert.ok(guardIndex >= 0);
  assert.ok(workerIndex > guardIndex);
  assert.equal((script.match(/\/api\/internal\/unified-data/g) || []).length, 1);
});

test("worker is invoked once with server secret and is never retried", async () => {
  const script = await source();
  assert.match(script, /Authorization: `Bearer \$\{cronSecret\}`/);
  assert.match(script, /invocationCount: 1/);
  assert.match(script, /workerRetried: false/);
  assert.match(script, /no retry was attempted/);
  assert.doesNotMatch(script, /for\s*\([^)]*\/api\/internal\/unified-data/);
});

test("secret and full worker body are excluded from logs and retained report", async () => {
  const script = await source();
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*cronSecret/);
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*authorization/i);
  assert.match(script, /credentialsRetained: false/);
  assert.match(script, /authorizationHeaderRetained: false/);
  assert.match(script, /rawWorkerResponseRetained: false/);
  assert.match(script, /providerPayloadsRetained: false/);
  assert.doesNotMatch(script, /workerPayload\?\.providerQuality/);
  assert.doesNotMatch(script, /workerPayload\?\.closingRecords\?\.latest/);
});

test("retained worker summary is allowlisted and paper-only", async () => {
  const script = await source();
  for (const field of ["httpStatus", "ok", "version", "capturedAt", "selections", "providerObservations", "incidentsActive", "incidentsResolved", "closingFinalized", "paperOnly"]) {
    assert.match(script, new RegExp(`${field}:`));
  }
  assert.match(script, /workerPayload\?\.paperOnly !== true/);
  assert.match(script, /realMoneyExecution: false/);
  assert.match(script, /bookmakerCredentials: false/);
});
