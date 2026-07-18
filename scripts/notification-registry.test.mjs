import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("notification migration forces RLS and computes token hash in PostgreSQL", async () => {
  const sql = await source("supabase/scorecaster_notification_registry.sql");
  assert.match(sql, /create table if not exists public\.notification_preferences/i);
  assert.match(sql, /create table if not exists public\.notification_devices/i);
  assert.match(sql, /alter table public\.notification_preferences force row level security/i);
  assert.match(sql, /alter table public\.notification_devices force row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /unique index[\s\S]*token_hash/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /v_token_hash := encode\(digest\(p_expo_push_token, 'sha256'\), 'hex'\)/i);
  assert.doesNotMatch(sql, /p_token_hash/);
  assert.match(sql, /delete from public\.notification_devices[\s\S]*user_id <> v_user_id/i);
  assert.match(sql, /notification_preferences_enforce_push_state/i);
  assert.match(sql, /notification_devices_sync_push_after_delete/i);
  assert.match(sql, /revoke insert, update on public\.notification_devices from authenticated/i);
  assert.match(sql, /revoke all on public\.notification_devices from anon/i);
});

test("notification API checks origin, auth and quota before mutations", async () => {
  const route = await source("app/api/cloud/notifications/route.js");
  const helperStart = route.indexOf("async function requireMutation");
  const originIndex = route.indexOf("mutationOriginAllowed(request)", helperStart);
  const authIndex = route.indexOf("getAuthenticatedContext(request)", originIndex);
  const quotaIndex = route.indexOf("enforceRateLimit(auth", authIndex);
  assert.ok(helperStart >= 0 && originIndex > helperStart && authIndex > originIndex && quotaIndex > authIndex);
  assert.match(route, /notification_device_register/);
  assert.match(route, /notification_preferences_write/);
  assert.match(route, /notification_device_remove/);
});

test("API responses and exports exclude raw push tokens and token hashes", async () => {
  const route = await source("app/api/cloud/notifications/route.js");
  const exportRoute = await source("app/api/account/export/route.js");
  assert.match(route, /const DEVICE_SELECT = "id,platform,app_version,build_version,enabled,last_seen_at,created_at,updated_at"/);
  assert.doesNotMatch(route, /select\([^\n]*expo_push_token/);
  assert.doesNotMatch(route, /select\([^\n]*token_hash/);
  assert.match(exportRoute, /notificationDeliveryTokensExported: false/);
  assert.doesNotMatch(exportRoute, /\.select\("[^"]*expo_push_token/);
  assert.doesNotMatch(exportRoute, /\.select\("[^"]*token_hash/);
});

test("push preference cannot be enabled without a successful device claim", async () => {
  const route = await source("app/api/cloud/notifications/route.js");
  const postStart = route.indexOf("export async function POST");
  const claimIndex = route.indexOf('rpc("claim_notification_device"', postStart);
  const pushEnableIndex = route.indexOf("push_enabled: true", claimIndex);
  assert.match(route, /CLIENT_PREFERENCE_KEYS = Object\.keys\(DEFAULT_PREFERENCES\)\.filter\(\(key\) => key !== "push_enabled"\)/);
  assert.ok(claimIndex > postStart && pushEnableIndex > claimIndex);
  assert.match(route, /push_enabled: false/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
});

test("Watchlist applies preferences before synchronizing Alert Inbox", async () => {
  const route = await source("app/api/cloud/watchlist/route.js");
  const buildIndex = route.indexOf("buildWatchlistState({ items: rows, currentPicks })");
  const filterIndex = route.indexOf("state.alerts.filter((alert) => alertAllowed", buildIndex);
  const syncIndex = route.indexOf("syncAlertInbox(auth.supabase, auth.user.id, allowedAlerts", filterIndex);
  assert.ok(buildIndex >= 0 && filterIndex > buildIndex && syncIndex > filterIndex);
  assert.match(route, /kickoff_enabled/);
  assert.match(route, /decision_enabled/);
  assert.match(route, /price_enabled/);
  assert.match(route, /in_app_enabled/);
});

test("account deletion removes delivery and notification data first", async () => {
  const route = await source("app/api/account/route.js");
  const deliveryIndex = route.indexOf('"notification_deliveries"');
  const deviceIndex = route.indexOf('"notification_devices"');
  const preferenceIndex = route.indexOf('"notification_preferences"');
  const inboxIndex = route.indexOf('"alert_inbox"');
  assert.ok(deliveryIndex >= 0 && deviceIndex > deliveryIndex && preferenceIndex > deviceIndex && inboxIndex > preferenceIndex);
  assert.match(route, /"notification device registrations"/);
});

test("native registration is explicit, permission-gated and reports real delivery readiness", async () => {
  const native = await source("mobile/src/lib/notifications.ts");
  const settings = await source("mobile/src/screens/SettingsScreen.tsx");
  const pkg = JSON.parse(await source("mobile/package.json"));
  const app = JSON.parse(await source("mobile/app.json"));
  assert.equal(pkg.dependencies["expo-notifications"], "~56.0.20");
  assert.equal(pkg.dependencies["expo-constants"], "~56.0.20");
  assert.ok(app.expo.plugins.some((entry) => Array.isArray(entry) && entry[0] === "expo-notifications"));
  assert.match(native, /setNotificationChannelAsync/);
  assert.match(native, /getPermissionsAsync/);
  assert.match(native, /requestPermissionsAsync/);
  assert.match(native, /getExpoPushTokenAsync\(\{ projectId: easProjectId \}\)/);
  assert.match(native, /The EAS project ID is not configured/);
  assert.match(native, /SecureStore\.setItemAsync\(DEVICE_ID_KEY/);
  assert.match(native, /deliveryConfigured\?: boolean/);
  assert.match(settings, /enableThisDevice/);
  assert.match(settings, /next\.deliveryActive/);
  assert.match(settings, /next\.deliveryConfigured/);
  assert.match(settings, /provider|toimitus|delivery/i);
});

test("web can edit categories but cannot register a push token", async () => {
  const web = await source("app/profile/NotificationSettings.jsx");
  assert.match(web, /method: "PUT"/);
  assert.match(web, /Push permission and token registration are available only in the native app/);
  assert.doesNotMatch(web, /expoPushToken|getExpoPushTokenAsync|method: "POST"/);
});
