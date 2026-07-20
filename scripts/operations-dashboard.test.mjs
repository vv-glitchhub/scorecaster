import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("operations API is authenticated, rate limited and user isolated", async () => {
  const route = await source("app/api/operations/route.js");
  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /bucket: "operations_overview"/);
  assert.match(route, /const userId = auth\.user\.id/);
  assert.ok((route.match(/\.eq\("user_id", userId\)/g) || []).length >= 8);
  assert.match(route, /auth\.supabase/);
  assert.doesNotMatch(route, /getSupabaseAdminClient|service_role/);
});

test("operations response exposes safe booleans but no secrets or push tokens", async () => {
  const route = await source("app/api/operations/route.js");
  assert.match(route, /serviceRoleConfigured/);
  assert.match(route, /cronSecretConfigured/);
  assert.match(route, /scoresProviderConfigured/);
  assert.match(route, /expoAccessTokenConfigured/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|ODDS_API_KEY\s*:|CRON_SECRET\s*:|expo_push_token|token_hash/);
  assert.match(route, /productBoundary: "sports analysis, alerting and virtual paper tracking only"/);
});

test("worker health classification distinguishes disabled, stale, failed and active queues", async () => {
  const helper = await source("lib/operations-status.js");
  for (const status of ["migration_required", "disabled", "running", "error", "waiting", "stale", "healthy", "attention", "working"]) {
    assert.match(helper, new RegExp(`status: "${status}"`));
  }
  assert.match(helper, /intervalMinutes \|\| 15\) \* 4/);
  assert.match(helper, /provider_accepted/);
  assert.match(helper, /counts\.failed > 0 \|\| counts\.retry > 20/);
});

test("dashboard is trilingual and links operational surfaces without exposing raw secrets", async () => {
  const client = await source("app/operations/OperationsClient.jsx");
  const page = await source("app/operations/page.jsx");
  const production = await source("app/production-status/production-status-client.jsx");
  assert.match(page, /OperationsClient/);
  assert.match(client, /fetch\("\/api\/operations"/);
  assert.match(client, /fi:/);
  assert.match(client, /en:/);
  assert.match(client, /es:/);
  assert.match(client, /href="\/production-status"/);
  assert.match(client, /href="\/alerts"/);
  assert.match(production, /href="\/operations"/);
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|ODDS_API_KEY|expo_push_token/);
});

test("operations overview includes worker, queue, launch and account activity signals", async () => {
  const route = await source("app/api/operations/route.js");
  for (const token of [
    "watchlist_monitor_state",
    "paper_settlement_monitor_state",
    "notification_deliveries",
    "activeWatchlistItems",
    "openPaperBets",
    "unreadActiveAlerts",
    "activeNotificationDevices",
    "marketTimelineSnapshots24h",
    "physicalPushDeviceRegistered"
  ]) assert.match(route, new RegExp(token));
});
