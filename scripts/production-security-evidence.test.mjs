import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildProductionSecurityEvidence, PRODUCTION_SECURITY_EVIDENCE_VERSION } from "../lib/production-security-evidence.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const policy = JSON.parse(await source("config/production-security.json"));

test("redacted production configuration evidence reports presence without secret values", () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-placeholder",
    SUPABASE_SERVICE_ROLE_KEY: "private-service-role-value",
    ODDS_API_KEY: "private-odds-value",
    CRON_SECRET: "private-cron-value",
    AGENT_DECISION_SIGNING_KEY: "private-signing-value",
    OPENAI_API_KEY: "private-openai-value",
    SCORECASTER_SHADOW_LEARNING_ENABLED: "false"
  };
  const report = buildProductionSecurityEvidence({ policy, env });
  const serialized = JSON.stringify(report);

  assert.equal(report.version, PRODUCTION_SECURITY_EVIDENCE_VERSION);
  assert.equal(report.requiredConfigurationPresent, true);
  assert.equal(report.serverOnlyBoundaryClean, true);
  assert.equal(report.readyForProtectedWorkerProductionProbe, true);
  assert.equal(report.shadowLearning.enabled, false);
  assert.equal(report.shadowLearning.rawValueIncluded, false);
  assert.equal(report.safety.secretValuesIncluded, false);
  for (const value of Object.values(env)) {
    if (value === "false") continue;
    assert.ok(!serialized.includes(value), `secret/config value leaked: ${value}`);
  }
});

test("forbidden public aliases for server-only variables fail the boundary", () => {
  const browserAlias = ["NEXT", "PUBLIC", "CRON", "SECRET"].join("_");
  const nativeAlias = ["EXPO", "PUBLIC", "ODDS", "API", "KEY"].join("_");
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-placeholder",
    SUPABASE_SERVICE_ROLE_KEY: "private",
    ODDS_API_KEY: "private",
    CRON_SECRET: "private",
    AGENT_DECISION_SIGNING_KEY: "private",
    [browserAlias]: "must-never-exist",
    [nativeAlias]: "must-never-exist"
  };
  const report = buildProductionSecurityEvidence({ policy, env });

  assert.equal(report.serverOnlyBoundaryClean, false);
  assert.deepEqual(report.forbiddenClientAliases.sort(), [nativeAlias, browserAlias].sort());
  assert.equal(report.safety.secretValuesIncluded, false);
});

test("missing production configuration remains explicit rather than inferred", () => {
  const report = buildProductionSecurityEvidence({ policy, env: {} });
  assert.equal(report.requiredConfigurationPresent, false);
  assert.ok(report.missingRequiredServerOnly.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.ok(report.missingRequiredServerOnly.includes("CRON_SECRET"));
  assert.ok(report.missingPublicClient.includes("NEXT_PUBLIC_SUPABASE_URL"));
  assert.equal(report.readyForProtectedWorkerProductionProbe, false);
});

test("production smoke emits guard-only worker probe evidence and never uses a valid cron secret", async () => {
  const smoke = await source("scripts/production-smoke.mjs");
  assert.match(smoke, /workerProbeEvidence/);
  assert.match(smoke, /worker-guard:none/);
  assert.match(smoke, /worker-guard:invalid/);
  assert.match(smoke, /scorecaster-intentionally-invalid-worker-probe/);
  assert.match(smoke, /validCronSecretUsed: false/);
  assert.match(smoke, /workerInvokedByGuardProbe: false/);
  assert.match(smoke, /paperRowsCreatedByGuardProbe: false/);
  assert.doesNotMatch(smoke, /authorization:\s*`Bearer \$\{process\.env\.CRON_SECRET\}`/);
});

test("static worker contract audit checks every declared internal worker before runtime actions", async () => {
  const audit = await source("scripts/protected-worker-contract-audit.mjs");
  assert.match(audit, /manifest\.internalWorkers/);
  assert.match(audit, /cronSecretConfigured\|CRON_SECRET/);
  assert.match(audit, /authorization\|authorized/i);
  assert.match(audit, /guardBeforeAction/);
  assert.match(audit, /Cache-Control/);
  assert.match(audit, /implementationFingerprint/);
  assert.match(audit, /sourceSha256/);
  assert.match(audit, /workerInvoked: false/);
});

test("client boundary audit scans built web static assets and mobile source without loading secrets", async () => {
  const audit = await source("scripts/client-secret-boundary-audit.mjs");
  assert.match(audit, /\.next", "static/);
  assert.match(audit, /mobile", "src/);
  assert.match(audit, /serverOnlyRequired/);
  assert.match(audit, /serverOnlyConditional/);
  assert.match(audit, /signedMobileBundleInspected: false/);
  assert.match(audit, /secretValuesLoadedForComparison: false/);
  assert.match(audit, /--require-web-build/);
});

await import("./protected-worker-production-evidence.test.mjs");
