import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptSource = () => readFile(new URL("./post-deploy-unified-data-capture.mjs", import.meta.url), "utf8");
const workflowSource = () => readFile(new URL("../.github/workflows/post-deploy-provider-evidence-v1.yml", import.meta.url), "utf8");

test("post-deploy capture is locked to the canonical production host and full commit SHA", async () => {
  const script = await scriptSource();
  assert.match(script, /parsedBase\.host !== "scorecaster\.vercel\.app"/);
  assert.match(script, /\^\[a-f0-9\]\{40\}\$/);
  assert.match(script, /observedCommit === targetSha/);
  assert.match(script, /worker was not invoked/);
});

test("protected worker invocation happens only after production commit confirmation", async () => {
  const script = await scriptSource();
  const guardIndex = script.indexOf("if (!productionMatchedAt)");
  const workerIndex = script.indexOf("/api/internal/unified-data");
  assert.ok(guardIndex >= 0);
  assert.ok(workerIndex > guardIndex);
  assert.equal((script.match(/\/api\/internal\/unified-data/g) || []).length, 1);
});

test("worker is invoked once with server secret and is never retried", async () => {
  const script = await scriptSource();
  assert.match(script, /Authorization: `Bearer \$\{cronSecret\}`/);
  assert.match(script, /invocationCount: 1/);
  assert.match(script, /workerRetried: false/);
  assert.match(script, /no retry was attempted/);
  assert.doesNotMatch(script, /for\s*\([^)]*\/api\/internal\/unified-data/);
});

test("secret and full worker body are excluded from logs and retained report", async () => {
  const script = await scriptSource();
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
  const script = await scriptSource();
  for (const field of ["httpStatus", "ok", "version", "capturedAt", "selections", "providerObservations", "incidentsActive", "incidentsResolved", "closingFinalized", "paperOnly"]) {
    assert.match(script, new RegExp(`${field}:`));
  }
  assert.match(script, /workerPayload\?\.paperOnly !== true/);
  assert.match(script, /realMoneyExecution: false/);
  assert.match(script, /bookmakerCredentials: false/);
});

test("workflow never exposes production capture to pull-request execution", async () => {
  const workflow = await workflowSource();
  assert.doesNotMatch(workflow, /pull_request_target\s*:/);
  assert.match(workflow, /production-capture:\n\s+if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /CRON_SECRET: \$\{\{ secrets\.CRON_SECRET \}\}/);

  const contractIndex = workflow.indexOf("  contract:");
  const productionIndex = workflow.indexOf("  production-capture:");
  assert.ok(contractIndex >= 0 && productionIndex > contractIndex);
  const contractBlock = workflow.slice(contractIndex, productionIndex);
  assert.doesNotMatch(contractBlock, /CRON_SECRET|secrets\./);
  assert.doesNotMatch(contractBlock, /post-deploy-unified-data-capture\.mjs\s*$/m);
});

test("production workflow keeps deployment wait bounded and worker mutation single-shot", async () => {
  const workflow = await workflowSource();
  assert.match(workflow, /DEPLOYMENT_WAIT_SECONDS: 600/);
  assert.match(workflow, /DEPLOYMENT_POLL_SECONDS: 15/);
  assert.equal((workflow.match(/run: node scripts\/post-deploy-unified-data-capture\.mjs/g) || []).length, 1);
  assert.match(workflow, /timeout-minutes: 15/);
});

test("provider pipeline changes trigger post-deploy production capture", async () => {
  const workflow = await workflowSource();
  for (const path of [
    "lib/open-meteo-provider.js",
    "lib/results-provider.js",
    "lib/results-league-map.js",
    "lib/form-rest-shadow-model.mjs",
    ".github/workflows/collector.yml",
    ".github/workflows/unified-data-capture.yml"
  ]) {
    assert.ok(workflow.includes(`- \"${path}\"`), `missing post-deploy trigger path ${path}`);
  }
});

test("workflow uploads only the redacted artifacts directory", async () => {
  const workflow = await workflowSource();
  assert.match(workflow, /path: artifacts\/\*\.json/);
  assert.doesNotMatch(workflow, /path:\s*\.\/?$/m);
  assert.doesNotMatch(workflow, /path:\s*\*\*/);
});
