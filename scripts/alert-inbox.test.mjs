import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  defaultAlertInboxSettings,
  normalizeAlertInboxSettings
} from "../lib/alert-inbox-service.js";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("Alert Inbox V1 migration isolates rows and deduplicates per user", async () => {
  const sql = await source("supabase/scorecaster_alert_inbox.sql");
  assert.match(sql, /references public\.watchlist_items\(id\) on delete cascade/i);
  assert.match(sql, /unique index[\s\S]*user_id, fingerprint/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /revoke all on public\.alert_inbox from anon/i);
  assert.match(sql, /severity in \('high', 'medium', 'info'\)/i);
});

test("Alert Inbox V2 migration adds dismissal and user-isolated preferences", async () => {
  const sql = await source("supabase/scorecaster_alert_inbox_v2.sql");
  assert.match(sql, /add column if not exists dismissed_at timestamptz/i);
  assert.match(sql, /create table if not exists public\.alert_inbox_settings/i);
  assert.match(sql, /minimum_severity in \('info', 'medium', 'high'\)/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /revoke all on public\.alert_inbox_settings from anon/i);
});

test("settings normalization is conservative and bounded to known values", () => {
  assert.deepEqual(defaultAlertInboxSettings(), {
    enabled: true,
    minimum_severity: "info",
    kickoff_enabled: true,
    price_enabled: true,
    decision_enabled: true,
    availability_enabled: true
  });
  assert.deepEqual(normalizeAlertInboxSettings({
    enabled: false,
    minimumSeverity: "high",
    priceEnabled: false,
    decisionEnabled: false
  }), {
    enabled: false,
    minimum_severity: "high",
    kickoff_enabled: true,
    price_enabled: false,
    decision_enabled: false,
    availability_enabled: true
  });
  assert.equal(normalizeAlertInboxSettings({ minimumSeverity: "critical" }).minimum_severity, "info");
});

test("inbox synchronization preserves dedupe, preferences and dismissal state", async () => {
  const service = await source("lib/alert-inbox-service.js");
  assert.match(service, /upsert\(rows, \{ onConflict: "user_id,fingerprint" \}\)/);
  assert.match(service, /read_at: previous\?\.active \? previous\.read_at : null/);
  assert.match(service, /dismissed_at = previous\?\.active \? previous\.dismissed_at : null/);
  assert.match(service, /alertAllowed\(alert, settings\)/);
  assert.match(service, /SEVERITY_RANK\[severity\] < SEVERITY_RANK\[settings\.minimum_severity\]/);
  assert.match(service, /!currentFingerprints\.has\(item\.fingerprint\)/);
  assert.match(service, /update\(\{ active: false, resolved_at: now, last_seen_at: now \}\)/);
  assert.match(service, /Alert Inbox V2 settings migration is not active/);
  assert.doesNotMatch(service, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("Watchlist refresh still synchronizes only server-generated alerts", async () => {
  const route = await source("app/api/cloud/watchlist/route.js");
  const stateIndex = route.indexOf("buildWatchlistState({ items: rows, currentPicks })");
  const syncIndex = route.indexOf("syncAlertInbox(auth.supabase, auth.user.id, state.alerts");
  assert.ok(stateIndex >= 0);
  assert.ok(syncIndex > stateIndex);
  assert.match(route, /watchlist-alerts-v2\+alert-inbox-v1/);
  assert.match(route, /Alert Inbox could not be synchronized/);
});

test("Alert Inbox V2 API checks origin, auth, quotas and user scope", async () => {
  const route = await source("app/api/cloud/alerts/route.js");
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function PUT/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /mutationOriginAllowed\(request\)/);
  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /bucket: "alert_inbox_read"/);
  assert.match(route, /bucket: "alert_inbox_settings"/);
  assert.match(route, /bucket: "alert_inbox_write"/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /markAllRead/);
  assert.match(route, /read state are required/);
  assert.match(route, /dismissed_at/);
  assert.match(route, /pushEnabled: false/);
  assert.doesNotMatch(route, /body\.data\?\.title|body\.data\?\.message/);
});

test("account export and deletion include V2 history and settings", async () => {
  const exportRoute = await source("app/api/account/export/route.js");
  const accountRoute = await source("app/api/account/route.js");
  assert.match(exportRoute, /dismissed_at/);
  assert.match(exportRoute, /alertInboxSettings/);
  assert.match(exportRoute, /alertInbox:/);
  assert.match(accountRoute, /"alert_inbox_settings"/);
  assert.match(accountRoute, /"alert_inbox"/);
  assert.ok(accountRoute.indexOf('"alert_inbox_settings"') < accountRoute.indexOf('"alert_inbox"'));
});

test("web and native clients localize structured events and expose V2 controls", async () => {
  const [web, webCopy, mobile, mobileCopy, mobilePackage] = await Promise.all([
    source("app/alerts/AlertInboxClient.jsx"),
    source("lib/alert-inbox-copy.mjs"),
    source("mobile/src/screens/WatchlistScreen.tsx"),
    source("mobile/src/lib/alert-inbox-copy.ts"),
    source("mobile/package.json")
  ]);
  assert.match(web, /status=.*limit=100/);
  assert.match(web, /minimumSeverity/);
  assert.match(web, /markAllRead: true/);
  assert.match(web, /method, body/);
  assert.match(webCopy, /decision_changed/);
  assert.match(webCopy, /price_moved/);
  assert.match(mobile, /\/api\/cloud\/alerts/);
  assert.match(mobile, /minimumSeverity/);
  assert.match(mobile, /markAllRead: true/);
  assert.match(mobileCopy, /market_unavailable/);
  assert.doesNotMatch(mobilePackage, /expo-notifications/);
});
