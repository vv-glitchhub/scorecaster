import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("monitor migration isolates user state and atomically claims bounded work", async () => {
  const sql = await source("supabase/scorecaster_watchlist_monitor.sql");
  assert.match(sql, /create table if not exists public\.watchlist_monitor_state/i);
  assert.match(sql, /references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /after insert or update or delete on public\.watchlist_items/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /lease_expires_at = now\(\) \+ interval '10 minutes'/i);
  assert.match(sql, /next_check_at = now\(\) \+ interval '15 minutes'/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /grant execute on function public\.claim_watchlist_monitor_users\(integer\) to service_role/i);
  assert.match(sql, /grant execute on function public\.complete_watchlist_monitor_user/i);
  assert.doesNotMatch(sql, /expo_push_token|token_hash/i);
});

test("monitor loads verified Top Picks once per bounded sport group", async () => {
  const worker = await source("lib/watchlist-monitor.js");
  assert.match(worker, /MAX_USERS_PER_RUN = 20/);
  assert.match(worker, /MAX_ITEMS_PER_USER = 50/);
  assert.match(worker, /MAX_SPORTS_PER_REQUEST = 6/);
  assert.match(worker, /MAX_SPORTS_PER_RUN = 12/);
  assert.match(worker, /new URL\("\/api\/top-picks", origin\)/);
  assert.match(worker, /target\.searchParams\.set\("sports", group\.join\(","\)\)/);
  assert.match(worker, /rpc\("claim_watchlist_monitor_users"/);
  assert.match(worker, /chooseEntriesWithinSportBudget/);
  assert.match(worker, /Deferred by the per-run sport budget/);
});

test("monitor synchronizes only preference-allowed alerts and captures descriptive history", async () => {
  const worker = await source("lib/watchlist-monitor.js");
  assert.match(worker, /buildWatchlistState/);
  assert.match(worker, /state\.alerts\.filter\(\(alert\) => alertAllowed/);
  assert.match(worker, /syncAlertInbox\(admin, entry\.userId, allowedAlerts/);
  assert.match(worker, /currentSnapshotFromPick/);
  assert.match(worker, /initialSnapshotFromWatchlist/);
  assert.match(worker, /materiallyDifferentSnapshot/);
  assert.match(worker, /MIN_TIMELINE_INTERVAL_MS = 15 \* 60 \* 1000/);
  assert.match(worker, /market_timeline_snapshots/);
  assert.doesNotMatch(worker, /sharp money|inside information|guaranteed outcome/i);
});

test("monitor route is secret protected and fail closed", async () => {
  const route = await source("app/api/internal/watchlist-monitor/route.js");
  const config = await source("lib/watchlist-monitor-config.js");
  assert.match(config, /SCORECASTER_WATCHLIST_MONITOR_ENABLED === "true"/);
  assert.match(config, /cronSecret\.length >= 16/);
  assert.match(config, /request\.headers\.get\("authorization"\) === `Bearer \$\{secret\}`/);
  assert.match(route, /watchlistMonitorAuthorizationValid\(request\)/);
  assert.match(route, /Watchlist Monitor is disabled/);
  assert.match(route, /getSupabaseAdminClient\(\)/);
  assert.match(route, /maxDuration = 60/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET\s*:/);
});

test("authenticated status and account controls expose metadata without secrets", async () => {
  const statusRoute = await source("app/api/cloud/watchlist-monitor/route.js");
  const exportRoute = await source("app/api/account/export/route.js");
  const accountRoute = await source("app/api/account/route.js");
  const web = await source("app/watchlist/WatchlistClient.jsx");
  assert.match(statusRoute, /getAuthenticatedContext\(request\)/);
  assert.match(statusRoute, /watchlist_monitor_state/);
  assert.match(statusRoute, /last_items_count,last_alerts_count,last_snapshots_count/);
  assert.doesNotMatch(statusRoute, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|expo_push_token/);
  assert.match(exportRoute, /watchlistMonitor:/);
  assert.match(accountRoute, /"watchlist_monitor_state"/);
  assert.match(web, /Watchlist Monitor V1/);
  assert.match(web, /\/api\/cloud\/watchlist-monitor/);
});

test("background scheduler runs monitor before push delivery without blocking queued delivery", async () => {
  const workflow = await source(".github/workflows/notification-delivery.yml");
  const monitorIndex = workflow.indexOf("Run Watchlist Monitor cycle");
  const deliveryIndex = workflow.indexOf("Run bounded notification delivery cycle");
  assert.ok(monitorIndex >= 0 && deliveryIndex > monitorIndex);
  assert.match(workflow, /SCORECASTER_WATCHLIST_MONITOR_ENABLED/);
  assert.match(workflow, /SCORECASTER_NOTIFICATION_DELIVERY_ENABLED/);
  assert.match(workflow, /needs: monitor/);
  assert.match(workflow, /always\(\).*SCORECASTER_NOTIFICATION_DELIVERY_ENABLED/);
  assert.match(workflow, /\/api\/internal\/watchlist-monitor/);
  assert.match(workflow, /\/api\/internal\/notification-delivery/);
  assert.match(workflow, /Authorization: Bearer \$\{CRON_SECRET\}/);
});