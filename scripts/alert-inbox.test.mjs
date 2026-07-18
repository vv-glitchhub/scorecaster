import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("Alert Inbox migration isolates rows and deduplicates per user", async () => {
  const sql = await source("supabase/scorecaster_alert_inbox.sql");

  assert.match(sql, /references public\.watchlist_items\(id\) on delete cascade/i);
  assert.match(sql, /unique index[\s\S]*user_id, fingerprint/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /revoke all on public\.alert_inbox from anon/i);
  assert.match(sql, /severity in \('high', 'medium', 'info'\)/i);
});

test("inbox synchronization preserves read state, reopens resolved alerts and resolves missing fingerprints", async () => {
  const service = await source("lib/alert-inbox-service.js");

  assert.match(service, /upsert\(rows, \{ onConflict: "user_id,fingerprint" \}\)/);
  assert.match(service, /read_at: previous\?\.active \? previous\.read_at : null/);
  assert.match(service, /first_seen_at: previous\?\.first_seen_at \|\| now/);
  assert.match(service, /resolved_at: null/);
  assert.match(service, /!currentFingerprints\.has\(item\.fingerprint\)/);
  assert.match(service, /update\(\{ active: false, resolved_at: now, last_seen_at: now \}\)/);
  assert.match(service, /\.eq\("user_id", userId\)/);
  assert.doesNotMatch(service, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("Watchlist refresh filters server-generated alerts before inbox synchronization", async () => {
  const route = await source("app/api/cloud/watchlist/route.js");
  const stateIndex = route.indexOf("buildWatchlistState({ items: rows, currentPicks })");
  const filterIndex = route.indexOf("const allowedAlerts = state.alerts.filter");
  const syncIndex = route.indexOf("syncAlertInbox(auth.supabase, auth.user.id, allowedAlerts");

  assert.ok(stateIndex >= 0);
  assert.ok(filterIndex > stateIndex);
  assert.ok(syncIndex > filterIndex);
  assert.match(route, /watchlist-alerts-v2\+alert-inbox-v1/);
  assert.match(route, /inboxResult\.available === true/);
  assert.match(route, /Alert Inbox could not be synchronized/);
});

test("alert acknowledgement API checks origin, auth and quota before updating user rows", async () => {
  const route = await source("app/api/cloud/alerts/route.js");
  const originIndex = route.indexOf("mutationOriginAllowed(request)");
  const authIndex = route.indexOf("getAuthenticatedContext(request)", originIndex);
  const quotaIndex = route.indexOf("enforceRateLimit(auth", authIndex);
  const updateIndex = route.indexOf('.from("alert_inbox")', quotaIndex);

  assert.ok(originIndex >= 0);
  assert.ok(authIndex > originIndex);
  assert.ok(quotaIndex > authIndex);
  assert.ok(updateIndex > quotaIndex);
  assert.match(route, /bucket: "alert_inbox_write"/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /\.is\("read_at", null\)/);
  assert.match(route, /markAllRead/);
});

test("account export and deletion include Alert Inbox data", async () => {
  const exportRoute = await source("app/api/account/export/route.js");
  const accountRoute = await source("app/api/account/route.js");

  assert.match(exportRoute, /\.from\("alert_inbox"\)/);
  assert.match(exportRoute, /alertInbox:/);
  assert.match(exportRoute, /alert inbox and account data/);
  assert.match(accountRoute, /"alert_inbox"/);
  assert.match(accountRoute, /"alert inbox"/);
  assert.ok(accountRoute.indexOf('"alert_inbox"') < accountRoute.indexOf('"watchlist_items"'));
});

test("web and native Watchlist expose unread and mark-read controls", async () => {
  const web = await source("app/watchlist/WatchlistClient.jsx");
  const mobile = await source("mobile/src/screens/WatchlistScreen.tsx");

  assert.match(web, /"\/api\/cloud\/alerts"/);
  assert.match(web, /markAllRead: true/);
  assert.match(web, /Alert Inbox V1/);
  assert.match(mobile, /"\/api\/cloud\/alerts"/);
  assert.match(mobile, /markAllRead: true/);
  assert.match(mobile, /inboxSummary\.unread/);
});
