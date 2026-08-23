import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }
async function json(path) { return JSON.parse(await source(path)); }

test("release manifest defines the production origin, complete rollout and supported locales", async () => {
  const manifest = await json("config/release-readiness.json");
  assert.equal(manifest.version, 1);
  assert.equal(manifest.product, "Scorecaster");
  assert.equal(manifest.productionBaseUrl, "https://scorecaster.vercel.app");
  assert.equal(manifest.supabaseMigrations.length, 28);
  assert.deepEqual(manifest.productionPatches, [
    "scripts/apply-market-microstructure-v2.sql",
    "scripts/apply-calibration-lab-v1.sql",
    "scripts/apply-ai-coach-v1.sql",
    "scripts/apply-verified-live-monitor-v1.sql"
  ]);
  assert.equal(manifest.supabaseMigrations[0], "supabase/scorecaster_schema.sql");
  assert.equal(manifest.supabaseMigrations.at(-8), "supabase/scorecaster_autonomous_v13_hard_caps.sql");
  assert.equal(manifest.supabaseMigrations.at(-7), "supabase/scorecaster_autonomous_agent_risk_profile_v1.sql");
  assert.equal(manifest.supabaseMigrations.at(-6), "supabase/scorecaster_shadow_learning_v1.sql");
  assert.deepEqual(manifest.supabaseMigrations.slice(-5), [
    "supabase/scorecaster_shadow_candidate_observations_v1.sql",
    "supabase/scorecaster_shadow_candidate_settlement_batch_v1.sql",
    "supabase/scorecaster_shadow_candidate_trigger_safety_v1.sql",
    "supabase/scorecaster_shadow_candidate_settlement_batch_v1_fix.sql",
    "supabase/scorecaster_shadow_candidate_function_acl_v1.sql"
  ]);
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_notification_delivery.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_watchlist_monitor.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_decision_diagnostics.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_agent_decision_signing_vault.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_collector_v1.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_community_feed_v1.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_ai_intelligence_v1.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_unified_data.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_sports_analytics.sql"));
  assert.ok(manifest.supabaseMigrations.indexOf("supabase/scorecaster_agent_decision_signing_vault.sql") < manifest.supabaseMigrations.indexOf("supabase/scorecaster_collector_v1.sql"));
  assert.ok(manifest.supabaseMigrations.indexOf("supabase/scorecaster_collector_v1.sql") < manifest.supabaseMigrations.indexOf("supabase/scorecaster_unified_data.sql"));
  assert.deepEqual(manifest.mobileLocales.apple, ["fi", "en-US", "es-ES"]);
  assert.deepEqual(manifest.mobileLocales.googlePlay, ["fi-FI", "en-US", "es-ES"]);
  assert.ok(manifest.publicPages.length >= 12);
  assert.ok(manifest.publicPages.includes("/mission-control"));
  assert.ok(manifest.publicPages.includes("/polymarket-intelligence"));
  assert.ok(manifest.publicPages.includes("/diagnostics-v2"));
  assert.ok(manifest.publicPages.includes("/provider-health"));
  assert.ok(manifest.publicPages.includes("/data-layer"));
  assert.ok(manifest.publicPages.includes("/sports-analytics"));
  assert.ok(manifest.publicPages.includes("/data-collector"));
  assert.ok(manifest.protectedApis.some((item) => item.path === "/api/cloud/autonomy-mission-control" && item.method === "GET"));
  assert.ok(manifest.protectedApis.some((item) => item.path === "/api/cloud/polymarket-intelligence" && item.method === "GET"));
  assert.ok(manifest.internalWorkers.some((item) => item.path === "/api/internal/decision-diagnostics" && item.method === "GET"));
  assert.ok(manifest.internalWorkers.some((item) => item.path === "/api/internal/collector" && item.method === "GET"));
  assert.ok(manifest.internalWorkers.some((item) => item.path === "/api/internal/unified-data" && item.method === "GET"));
  assert.ok(manifest.internalWorkers.some((item) => item.path === "/api/internal/sports-analytics" && item.method === "GET"));
  assert.ok(manifest.internalWorkers.some((item) => item.path === "/api/internal/shadow-learning" && item.method === "GET"));
  assert.ok(manifest.internalWorkers.some((item) => item.path === "/api/internal/shadow-candidate-settlement" && item.method === "GET"));
  assert.ok(manifest.protectedApis.length + manifest.internalWorkers.length >= 21);
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "unified-data-history-worker" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "unified-data-closing-line" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "sports-analytics-storage-worker" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "sports-analytics-external-provider" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "sports-analytics-visual-audit" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "collector-rights-registry" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "collector-storage-worker" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "collector-research-boundary" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "autonomous-v12-circuit-breakers" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "autonomous-v12-mission-control" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "autonomous-agent-v13-governance" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "autonomous-agent-v13-database-hard-caps" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "autonomous-agent-v13-audit" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "autonomous-agent-risk-profile" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "autonomous-agent-v13-emergency-stop" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "shadow-learning-storage" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "shadow-learning-two-user-isolation" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "shadow-learning-promotion-boundary" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.every((item) => item.blocking === true));
});

test("repository release audit verifies routes, SQL order, headers and store metadata", async () => {
  const audit = await source("scripts/release-readiness.mjs");
  for (const token of [
    "config/release-readiness.json",
    "pageCandidates",
    "apiCandidates",
    "supabaseMigrations",
    "productionPatches",
    "apply-market-microstructure-v2.sql",
    "apply-calibration-lab-v1.sql",
    "apply-ai-coach-v1.sql",
    "apply-verified-live-monitor-v1.sql",
    "scorecaster_community_feed_v1.sql",
    "scorecaster_ai_intelligence_v1.sql",
    "scorecaster_sports_analytics.sql",
    "scorecaster_autonomous_agent.sql",
    "scorecaster_autonomous_agent_v2.sql",
    "scorecaster_autonomous_v13_hard_caps.sql",
    "scorecaster_autonomous_agent_risk_profile_v1.sql",
    "scorecaster_shadow_learning_v1.sql",
    "requiredSecurityHeaders",
    "mobile/store.config.json",
    "mobile/store/google-play-listing.json",
    ".github/workflows/production-smoke.yml"
  ]) assert.match(audit, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(audit, /Autonomous Agent V2 must run immediately after V1/);
  assert.match(audit, /Autonomous V13 hard caps must run immediately after V2/);
  assert.match(audit, /Autonomous Risk Profile V1 must run immediately after V13 hard caps/);
  assert.match(audit, /Shadow Learning must run immediately after Autonomous Risk Profile V1/);
  assert.match(audit, /API responses must remain no-store/);
  assert.match(audit, /External verification still required/);
  assert.match(audit, /example\\\.com/);
});

test("production smoke checks live pages, health, authentication guards and secret exclusion", async () => {
  const smoke = await source("scripts/production-smoke.mjs");
  assert.match(smoke, /SCORECASTER_SMOKE_BASE_URL/);
  assert.match(smoke, /SCORECASTER_SMOKE_ACCESS_TOKEN/);
  assert.match(smoke, /SCORECASTER_SMOKE_REPORT_PATH/);
  assert.match(smoke, /Smoke-test origin must use HTTPS/);
  assert.match(smoke, /requiredSecurityHeaders/);
  assert.match(smoke, /\/api\/health/);
  assert.match(smoke, /manifest\.protectedApis/);
  assert.match(smoke, /manifest\.internalWorkers/);
  assert.match(smoke, /secretFree/);
  assert.match(smoke, /authenticatedProbesEnabled: Boolean\(accessToken\)/);
  assert.doesNotMatch(smoke, /accessToken[,}]\s*$/m);
});

test("production smoke workflow runs manually and daily with retained reports", async () => {
  const workflow = await source(".github/workflows/production-smoke.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: "17 4 \* \* \*"/);
  assert.match(workflow, /node scripts\/release-readiness\.mjs/);
  assert.match(workflow, /node scripts\/production-smoke\.mjs/);
  assert.match(workflow, /SCORECASTER_SMOKE_ACCESS_TOKEN/);
  assert.match(workflow, /retention-days: 30/);
  assert.match(workflow, /permissions:\s+contents: read/s);
});

test("release readiness UI is trilingual and separates automated and manual evidence", async () => {
  const page = await source("app/release-readiness/page.jsx");
  const client = await source("app/release-readiness/ReleaseReadinessClient.jsx");
  const shell = await source("app/components/AppShell.jsx");
  const production = await source("app/production-status/production-status-client.jsx");
  assert.match(page, /release-readiness\.json/);
  assert.match(client, /fetch\("\/api\/health"/);
  assert.match(client, /fetch\("\/api\/operations"/);
  assert.match(client, /manualReleaseChecks/);
  assert.match(client, /fi:/);
  assert.match(client, /en:/);
  assert.match(client, /es:/);
  assert.match(client, /href="\/operations"/);
  assert.match(shell, /href: "\/release-readiness"/);
  assert.match(shell, /href: "\/polymarket-intelligence"/);
  assert.match(shell, /href: "\/sports-analytics"/);
  assert.match(production, /href="\/release-readiness"/);
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|ODDS_API_KEY|expo_push_token/);
});

test("store links stay on the reviewed production origin", async () => {
  const manifest = await json("config/release-readiness.json");
  const apple = await json("mobile/store.config.json");
  const google = await json("mobile/store/google-play-listing.json");
  for (const entry of Object.values(apple.apple.info)) {
    assert.ok(entry.marketingUrl.startsWith(manifest.productionBaseUrl));
    assert.ok(entry.supportUrl.startsWith(manifest.productionBaseUrl));
    assert.ok(entry.privacyPolicyUrl.startsWith(manifest.productionBaseUrl));
  }
  assert.ok(google.supportUrl.startsWith(manifest.productionBaseUrl));
  assert.ok(google.privacyPolicyUrl.startsWith(manifest.productionBaseUrl));
});
