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
  assert.equal(manifest.supabaseMigrations.length, 14);
  assert.equal(manifest.supabaseMigrations[0], "supabase/scorecaster_schema.sql");
  assert.equal(manifest.supabaseMigrations.at(-2), "supabase/scorecaster_settlement_monitor.sql");
  assert.equal(manifest.supabaseMigrations.at(-1), "supabase/scorecaster_autonomous_agent.sql");
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_notification_delivery.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_watchlist_monitor.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_decision_diagnostics.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_unified_data.sql"));
  assert.deepEqual(manifest.mobileLocales.apple, ["fi", "en-US", "es-ES"]);
  assert.deepEqual(manifest.mobileLocales.googlePlay, ["fi-FI", "en-US", "es-ES"]);
  assert.ok(manifest.publicPages.length >= 10);
  assert.ok(manifest.publicPages.includes("/polymarket-intelligence"));
  assert.ok(manifest.publicPages.includes("/diagnostics-v2"));
  assert.ok(manifest.publicPages.includes("/provider-health"));
  assert.ok(manifest.publicPages.includes("/data-layer"));
  assert.ok(manifest.protectedApis.some((item) => item.path === "/api/cloud/polymarket-intelligence" && item.method === "GET"));
  assert.ok(manifest.internalWorkers.some((item) => item.path === "/api/internal/decision-diagnostics" && item.method === "GET"));
  assert.ok(manifest.internalWorkers.some((item) => item.path === "/api/internal/unified-data" && item.method === "GET"));
  assert.ok(manifest.protectedApis.length + manifest.internalWorkers.length >= 17);
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "unified-data-history-worker" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "unified-data-closing-line" && item.blocking === true));
  assert.ok(manifest.manualReleaseChecks.every((item) => item.blocking === true));
});

test("repository release audit verifies routes, SQL order, headers and store metadata", async () => {
  const audit = await source("scripts/release-readiness.mjs");
  for (const token of [
    "config/release-readiness.json",
    "pageCandidates",
    "apiCandidates",
    "supabaseMigrations",
    "scorecaster_autonomous_agent.sql",
    "requiredSecurityHeaders",
    "mobile/store.config.json",
    "mobile/store/google-play-listing.json",
    ".github/workflows/production-smoke.yml"
  ]) assert.match(audit, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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