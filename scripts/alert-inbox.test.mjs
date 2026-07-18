import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("Alert Inbox V2 migration isolates rows, deduplicates and adds reversible dismissal", async () => {
  const sql = await source("supabase/scorecaster_alert_inbox.sql");

  assert.match(sql, /references public\.watchlist_items\(id\) on delete cascade/i);
  assert.match(sql, /unique index[\s\S]*user_id, fingerprint/i);
  assert.match(sql, /dismissed_at timestamptz/i);
  assert.match(sql, /idx_alert_inbox_user_visible/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /revoke all on public\.alert_inbox from anon/i);
  assert.match(sql, /severity in \('high', 'medium', 'info'\)/i);
  assert.doesNotMatch(sql, /alert_inbox_settings/i);
});

test("inbox synchronization preserves active read and dismissal state but reopens resolved alerts", async () => {
  const service = await source("lib/alert-inbox-service.js");

  assert.match(service, /ALERT_SELECT_V2/);
  assert.match(service, /dismissed_at/);
  assert.match(service, /upsert\(rows, \{ onConflict: "user_id,fingerprint" \}\)/);
  assert.match(service, /read_at: previous\?\.active \? previous\.read_at : null/);
  assert.match(service, /row\.dismissed_at = previous\?\.active \? previous\.dismissed_at : null/);
  assert.match(service, /first_seen_at: previous\?\.first_seen_at \|\| now/);
  assert.match(service, /resolved_at: null/);
  assert.match(service, /!currentFingerprints\.has\(item\.fingerprint\)/);
  assert.match(service, /update\(\{ active: false, resolved_at: now, last_seen_at: now \}\)/);
  assert.match(service, /includeDismissed/);
  assert.doesNotMatch(service, /alert_inbox_settings|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("Watchlist refresh keeps Notification Registry as the only alert preference authority", async () => {
  const route = await source("app/api/cloud/watchlist/route.js");
  const stateIndex = route.indexOf("buildWatchlistState({ items: rows, currentPicks })");
  const filterIndex = route.indexOf("const allowedAlerts = state.alerts.filter");
  const syncIndex = route.indexOf("syncAlertInbox(auth.supabase, auth.user.id, allowedAlerts");

  assert.ok(stateIndex >= 0);
  assert.ok(filterIndex > stateIndex);
  assert.ok(syncIndex > filterIndex);
  assert.match(route, /notification_preferences/);
  assert.match(route, /notification-preferences-v1/);
  assert.match(route, /inboxResult\.available === true/);
  assert.doesNotMatch(route, /alert_inbox_settings/);
});

test("Alert Inbox V2 API checks origin, auth and quota before read, dismiss and restore mutations", async () => {
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
  assert.match(route, /"dismissed"/);
  assert.match(route, /ACTION_VALUES = new Set\(\["read", "dismiss", "restore"\]\)/);
  assert.match(route, /dismissed_at: now, read_at: now/);
  assert.match(route, /dismissed_at: null/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /markAllRead/);
});

test("dedicated Alert Inbox page and export use Notification Registry without a duplicate settings table", async () => {
  const page = await source("app/alerts/page.jsx");
  const client = await source("app/alerts/AlertInboxClient.jsx");
  const shell = await source("app/components/AppShell.jsx");
  const exportRoute = await source("app/api/account/alert-inbox-export/route.js");
  const privacy = await source("app/privacy/alert-inbox-v2/page.jsx");

  assert.match(page, /AlertInboxClient/);
  assert.match(client, /status=\$\{encodeURIComponent\(nextStatus\)\}/);
  assert.match(client, /action: "dismiss"/);
  assert.match(client, /action: "restore"/);
  assert.match(client, /\/api\/account\/alert-inbox-export/);
  assert.match(shell, /href: "\/alerts"/);
  assert.match(exportRoute, /notification_preferences/);
  assert.match(exportRoute, /dismissed_at/);
  assert.doesNotMatch(exportRoute, /alert_inbox_settings/);
  assert.match(privacy, /Reversible dismissal/);
});

test("native Watchlist exposes Alert Inbox V2 read and reversible dismissal controls", async () => {
  const mobile = await source("mobile/src/screens/WatchlistScreen.tsx");

  assert.match(mobile, /Alert Inbox V2/);
  assert.match(mobile, /"\/api\/cloud\/alerts"/);
  assert.match(mobile, /markAllRead: true/);
  assert.match(mobile, /action: "read" \| "dismiss"/);
  assert.match(mobile, /updateAlert\(item\.id, "dismiss"\)/);
  assert.match(mobile, /inboxSummary\.dismissed/);
});
