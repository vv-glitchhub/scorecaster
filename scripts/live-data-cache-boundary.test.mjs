import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluateLiveDataResponseHeaders, redactCacheProbeHeaders } from "../lib/live-data-cache-boundary.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("no-store response with non-cached Vercel state passes", () => {
  const result = evaluateLiveDataResponseHeaders({
    "cache-control": "no-store, max-age=0",
    "age": "0",
    "x-vercel-cache": "MISS"
  }, {
    requiredCacheControlTokens: ["no-store"],
    forbiddenVercelCacheStates: ["HIT", "STALE"],
    maximumAgeHeaderSeconds: 0
  });
  assert.equal(result.passed, true);
  assert.deepEqual(result.failures, []);
});

test("cached or cacheable live response fails closed", () => {
  for (const headers of [
    { "cache-control": "public, max-age=60", "x-vercel-cache": "MISS" },
    { "cache-control": "no-store", "x-vercel-cache": "HIT" },
    { "cache-control": "no-store", "age": "12", "x-vercel-cache": "MISS" }
  ]) {
    const result = evaluateLiveDataResponseHeaders(headers, {
      requiredCacheControlTokens: ["no-store"],
      forbiddenVercelCacheStates: ["HIT", "STALE"],
      maximumAgeHeaderSeconds: 0
    });
    assert.equal(result.passed, false);
    assert.ok(result.failures.length > 0);
  }
});

test("probe evidence header redaction uses an explicit allowlist", () => {
  const redacted = redactCacheProbeHeaders({
    "cache-control": "no-store",
    "x-vercel-cache": "MISS",
    "authorization": "Bearer must-not-appear",
    "set-cookie": "secret-cookie"
  }, ["cache-control", "x-vercel-cache"]);
  assert.deepEqual(redacted, {
    "cache-control": "no-store",
    "x-vercel-cache": "MISS"
  });
});

test("repository cache audit proves the reviewed service worker bypass", () => {
  const run = spawnSync(process.execPath, ["scripts/live-data-cache-boundary-audit.mjs"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(run.stdout);
  assert.equal(report.status, "passed");
  assert.equal(report.repositoryVerified, true);
  assert.equal(report.productionVerified, false);
  assert.equal(report.apiHeaderRule.sourceRulePresent, true);
  assert.equal(report.serviceWorkerBoundary.mode, "reviewed-network-only-api-bypass");
  assert.equal(report.serviceWorkerBoundary.apiBypassPresent, true);
  assert.equal(report.serviceWorkerBoundary.apiBypassBeforeInterception, true);
  assert.equal(report.serviceWorkerBoundary.offlineAssetAllowlistPresent, true);
  assert.equal(report.serviceWorkerBoundary.unexpectedCapabilityCount, 0);
  assert.equal(report.releaseGate.id, "live-data-pwa-cache-boundary");
  assert.equal(report.releaseGate.productionEvidenceRequired, true);
  assert.equal(report.evidenceBoundary.secretValuesIncluded, false);
});

test("live API routes cannot override the global no-store boundary with public CDN caching", async () => {
  const audit = await readFile(resolve(root, "scripts/live-data-cache-boundary-audit.mjs"), "utf8");
  const recommendations = await readFile(resolve(root, "app/api/recommendations/route.js"), "utf8");
  assert.match(audit, /cacheable-api-response-header/);
  assert.match(recommendations, /"Cache-Control": "no-store, max-age=0"/);
  assert.match(recommendations, /cache: "no-store"/);
  assert.doesNotMatch(recommendations, /s-maxage|stale-while-revalidate/);
});

test("canonical release manifest records the verified live cache gate", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "config/release-readiness.json"), "utf8"));
  const matches = manifest.manualReleaseChecks.filter((item) => item.id === "live-data-pwa-cache-boundary");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].blocking, false);
});

test("policy keeps the paper-only boundary explicit", async () => {
  const policy = JSON.parse(await readFile(resolve(root, "config/live-data-cache-boundary.json"), "utf8"));
  assert.equal(policy.productBoundary.paperOnly, true);
  assert.equal(policy.productBoundary.bookmakerLogin, false);
  assert.equal(policy.productBoundary.deposits, false);
  assert.equal(policy.productBoundary.withdrawals, false);
  assert.equal(policy.productBoundary.cashOut, false);
  assert.equal(policy.productBoundary.realMoneyExecution, false);
});
