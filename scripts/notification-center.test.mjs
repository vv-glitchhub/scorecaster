import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildNotificationCandidates,
  normalizeNotificationSettings,
  summarizeNotifications
} from "../lib/notification-center.mjs";

const NOW = Date.parse("2026-07-18T12:00:00Z");

function alert(overrides = {}) {
  return {
    id: "watch-1-price-move",
    type: "price_moved",
    severity: "medium",
    watchlistId: "00000000-0000-4000-8000-000000000001",
    eventId: "event-1",
    selection: "Home FC",
    match: "Home FC – Away FC",
    commenceTime: "2026-07-18T18:00:00Z",
    addedOdds: 2.2,
    currentOdds: 2.0,
    oddsMove: -0.0909,
    moveThreshold: 0.05,
    title: "client-facing title is not persisted",
    message: "client-facing message is not persisted",
    ...overrides
  };
}

test("notification candidates are structured, bounded and deduplicated", () => {
  const candidates = buildNotificationCandidates([alert(), alert()], {}, NOW);
  assert.equal(candidates.length, 1);
  assert.match(candidates[0].source_key, /^watchlist:price_moved:[a-f0-9]{8}$/);
  assert.equal(candidates[0].notification_type, "price_moved");
  assert.equal(candidates[0].severity, "medium");
  assert.equal(candidates[0].payload.source, "watchlist-alerts-v2");
  assert.equal(candidates[0].payload.currentOdds, 2);
  assert.equal("title" in candidates[0], false);
  assert.equal("message" in candidates[0], false);
});

test("material price buckets create stable keys without notifying every tiny change", () => {
  const first = buildNotificationCandidates([alert({ oddsMove: -0.061, currentOdds: 2.07 })], {}, NOW)[0];
  const sameBucket = buildNotificationCandidates([alert({ oddsMove: -0.091, currentOdds: 2.0 })], {}, NOW)[0];
  const stronger = buildNotificationCandidates([alert({ oddsMove: -0.121, currentOdds: 1.93 })], {}, NOW)[0];
  assert.equal(first.source_key, sameBucket.source_key);
  assert.notEqual(first.source_key, stronger.source_key);
});

test("notification preferences filter categories and severity", () => {
  const settings = normalizeNotificationSettings({
    minimumSeverity: "high",
    priceEnabled: false,
    kickoffEnabled: true
  });
  const candidates = buildNotificationCandidates([
    alert({ severity: "high" }),
    alert({ type: "kickoff_soon", severity: "medium", minutesToKickoff: 60 }),
    alert({ type: "decision_changed", severity: "high", addedDecision: "PLAY", currentDecision: "WATCH" })
  ], settings, NOW);
  assert.deepEqual(candidates.map((item) => item.notification_type), ["decision_changed"]);
  assert.equal(buildNotificationCandidates([alert()], { inAppEnabled: false }, NOW).length, 0);
});

test("notification summary excludes dismissed rows and counts unread high severity", () => {
  const summary = summarizeNotifications([
    { severity: "high", read_at: null, dismissed_at: null },
    { severity: "medium", read_at: "2026-07-18T10:00:00Z", dismissed_at: null },
    { severity: "high", read_at: null, dismissed_at: "2026-07-18T11:00:00Z" }
  ]);
  assert.deepEqual(summary, { total: 2, unread: 1, high: 1, unreadHigh: 1 });
});

test("Notification Center migration forces RLS for items and settings", async () => {
  const migration = await readFile(new URL("../supabase/scorecaster_notification_center.sql", import.meta.url), "utf8");
  assert.match(migration, /alter table public\.notification_items enable row level security/i);
  assert.match(migration, /alter table public\.notification_items force row level security/i);
  assert.match(migration, /alter table public\.notification_settings force row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/i);
  assert.match(migration, /unique index[\s\S]*user_id, source_key/i);
  assert.match(migration, /revoke all on public\.notification_items from anon/i);
  assert.match(migration, /revoke all on public\.notification_settings from anon/i);
});

test("protected API authenticates, rate-limits and scopes every user query", async () => {
  const route = await readFile(new URL("../app/api/cloud/notifications/route.js", import.meta.url), "utf8");
  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /mutationOriginAllowed\(request\)/);
  assert.match(route, /bucket: "notification_read"/);
  assert.match(route, /bucket: "notification_sync"/);
  assert.match(route, /bucket: "notification_write"/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /buildWatchlistState\(/);
  assert.match(route, /buildNotificationCandidates\(/);
  assert.match(route, /\.upsert\(records, \{ onConflict: "user_id,source_key" \}\)/);
  assert.match(route, /pushEnabled: false/);
  assert.doesNotMatch(route, /body\.data\?\.title/);
  assert.doesNotMatch(route, /body\.data\?\.message/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("account controls and clients include Notification Center without push dependencies", async () => {
  const [accountExport, accountDelete, web, mobile, mobilePackage, health] = await Promise.all([
    readFile(new URL("../app/api/account/export/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/notifications/NotificationCenterClient.jsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/screens/WatchlistScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/health/route.js", import.meta.url), "utf8")
  ]);
  assert.match(accountExport, /notificationSettings/);
  assert.match(accountExport, /notifications:/);
  assert.match(accountDelete, /"notification_items"/);
  assert.match(accountDelete, /"notification_settings"/);
  assert.match(web, /Notification Center V1/);
  assert.match(web, /markAllRead/);
  assert.match(mobile, /\/api\/cloud\/notifications/);
  assert.match(mobile, /Background push is not enabled/);
  assert.doesNotMatch(mobilePackage, /expo-notifications/);
  assert.match(health, /notificationCenterBackgroundPush: false/);
  assert.match(health, /notificationCenterDeviceTokensStored: false/);
});
