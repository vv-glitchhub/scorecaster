import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("delivery migration isolates metadata, deduplicates devices and atomically claims work", async () => {
  const sql = await source("supabase/scorecaster_notification_delivery.sql");
  assert.match(sql, /create table if not exists public\.notification_deliveries/i);
  assert.match(sql, /unique index[\s\S]*alert_id, device_id/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /lease_expires_at = now\(\) \+ interval '5 minutes'/i);
  assert.match(sql, /attempt_count < 5/i);
  assert.match(sql, /worker_lease_exhausted/i);
  assert.match(sql, /status = 'sending'[\s\S]*lease_expires_at < now\(\)[\s\S]*attempt_count >= 5/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /grant select on public\.notification_deliveries to authenticated/i);
  assert.match(sql, /grant execute on function public\.claim_notification_deliveries\(integer\) to service_role/i);
  assert.doesNotMatch(sql, /expo_push_token|token_hash/i);
});

test("delivery worker batches Expo sends and checks receipts after the safety delay", async () => {
  const worker = await source("lib/notification-delivery.js");
  assert.match(worker, /https:\/\/exp\.host\/--\/api\/v2\/push\/send/);
  assert.match(worker, /https:\/\/exp\.host\/--\/api\/v2\/push\/getReceipts/);
  assert.match(worker, /MAX_SEND_BATCH = 100/);
  assert.match(worker, /MAX_RECEIPT_BATCH = 1000/);
  assert.match(worker, /RECEIPT_DELAY_MS = 15 \* 60 \* 1000/);
  assert.match(worker, /RECEIPT_EXPIRY_MS = 23 \* 60 \* 60 \* 1000/);
  assert.match(worker, /rpc\("claim_notification_deliveries"/);
  assert.match(worker, /onConflict: "alert_id,device_id", ignoreDuplicates: true/);
  assert.match(worker, /DeviceNotRegistered/);
  assert.match(worker, /MessageRateExceeded/);
  assert.match(worker, /attempt_count \|\| 0\) >= MAX_ATTEMPTS/);
  assert.match(worker, /update\(\{ enabled: false \}\)/);
  assert.match(worker, /\.is\("read_at", null\)/);
  assert.match(worker, /\.is\("dismissed_at", null\)/);
});

test("internal delivery route fails closed and never accepts an unprotected invocation", async () => {
  const route = await source("app/api/internal/notification-delivery/route.js");
  const config = await source("lib/notification-delivery-config.js");
  assert.match(config, /SCORECASTER_NOTIFICATION_DELIVERY_ENABLED === "true"/);
  assert.match(config, /cronSecret\.length >= 16/);
  assert.match(config, /request\.headers\.get\("authorization"\) === `Bearer \$\{secret\}`/);
  assert.match(route, /notificationDeliveryAuthorizationValid\(request\)/);
  assert.match(route, /Notification delivery cron secret is not configured/);
  assert.match(route, /Notification delivery is disabled/);
  assert.match(route, /getSupabaseAdminClient\(\)/);
  assert.match(route, /maxDuration = 60/);
  assert.doesNotMatch(route, /expo_push_token|SUPABASE_SERVICE_ROLE_KEY|EXPO_ACCESS_TOKEN/);
});

test("notification API and health report configured delivery state without exposing tokens", async () => {
  const route = await source("app/api/cloud/notifications/route.js");
  const health = await source("app/api/health/route.js");
  assert.match(route, /notificationDeliveryConfiguration/);
  assert.match(route, /deliveryActive: configuration\.deliveryActive/);
  assert.match(route, /deliverySchedulingManagedExternally/);
  assert.match(route, /const DEVICE_SELECT = "id,platform,app_version,build_version,enabled,last_seen_at,created_at,updated_at"/);
  assert.doesNotMatch(route, /select\([^\n]*expo_push_token/);
  assert.doesNotMatch(route, /select\([^\n]*token_hash/);
  assert.match(health, /notificationDeliveryV1/);
  assert.match(health, /notificationDeliveryTicketAndReceiptTracking: true/);
  assert.match(health, /alertInboxBackgroundPushDelivery: notificationDelivery\.deliveryActive/);
  assert.match(health, /opt-in-expo-push-with-ticket-and-receipt-audit/);
});

test("export and deletion include delivery metadata but exclude raw tokens", async () => {
  const exportRoute = await source("app/api/account/export/route.js");
  const accountRoute = await source("app/api/account/route.js");
  assert.match(exportRoute, /notificationDeliveryTokensExported: false/);
  assert.match(exportRoute, /notificationDeliveries:/);
  assert.match(exportRoute, /notificationDevices:/);
  assert.doesNotMatch(exportRoute, /\.select\("[^"]*expo_push_token/);
  assert.doesNotMatch(exportRoute, /\.select\("[^"]*token_hash/);
  assert.ok(accountRoute.indexOf('"notification_deliveries"') < accountRoute.indexOf('"notification_devices"'));
  assert.match(accountRoute, /"notification delivery history"/);
});

test("opt-in scheduler uses repository controls while Vercel Hobby config stays deployable", async () => {
  const vercel = JSON.parse(await source("vercel.json"));
  const scheduler = await source(".github/workflows/notification-delivery.yml");
  assert.ok(Array.isArray(vercel.crons));
  assert.equal(vercel.crons.some((entry) => entry.path === "/api/internal/notification-delivery"), false);
  assert.match(scheduler, /cron: "\*\/15 \* \* \* \*"/);
  assert.match(scheduler, /vars\.SCORECASTER_NOTIFICATION_DELIVERY_ENABLED == 'true'/);
  assert.match(scheduler, /secrets\.SCORECASTER_NOTIFICATION_DELIVERY_URL/);
  assert.match(scheduler, /secrets\.SCORECASTER_CRON_SECRET/);
  assert.match(scheduler, /Authorization: Bearer \$\{CRON_SECRET\}/);
  assert.match(scheduler, /https:\/\/\*\)/);
});
