import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("home page uses the simplified Today experience", async () => {
  const page = await file("app/page.jsx");
  const today = await file("app/components/TodayPageClient.jsx");
  assert.match(page, /TodayPageClient/);
  assert.match(today, /\/api\/scorecaster-app/);
  assert.match(today, /view=summary/);
  assert.match(today, /Päivän pitkäveto/);
  assert.match(today, /AI Feed/);
  assert.match(today, /paper-only/);
});

test("Top Picks list consumers request the compact public view", async () => {
  const consumers = await Promise.all([
    file("app/DashboardClient.jsx"),
    file("app/events/EventsClient.jsx"),
    file("app/agent/AgentClient.jsx"),
    file("app/intelligence/page.jsx"),
    file("mobile/src/screens/HomeScreen.tsx"),
    file("mobile/src/screens/PicksScreen.tsx")
  ]);
  for (const consumer of consumers) assert.match(consumer, /view=summary/);
});

test("unified API is publishable-only and bounded", async () => {
  const route = await file("app/api/scorecaster-app/route.js");
  assert.match(route, /\.eq\("publishable", true\)/);
  assert.match(route, /clampInt\(url\.searchParams\.get\("limit"\), 10000, 100, 10000\)/);
  assert.match(route, /buildProductionControlCenter/);
  assert.match(route, /buildIntelligenceBundle/);
  assert.match(route, /buildIntelligenceV4/);
  assert.match(route, /view === "summary"/);
  assert.match(route, /const summaryEvents/);
});

test("ready app still exposes all core production views", async () => {
  const client = await file("app/ScorecasterReadyClient.jsx");
  for (const marker of ["Daily Top 3", "AI Coach", "Closing line", "All data", "paper-only", "calibration", "riskSignals"]) {
    assert.ok(client.includes(marker), `missing ${marker}`);
  }
  assert.match(client, /\/api\/scorecaster-app/);
  assert.match(client, /Näytä kaikki data/);
});

test("legacy value surface uses fresh unified data instead of stale value_bets rows", async () => {
  const route = await file("app/api/value-bets/route.js");
  const client = await file("app/components/ValueBetsSection.js");

  assert.match(route, /from\("unified_data_snapshots"\)/);
  assert.match(route, /\.gte\("commence_time", nowIso\)/);
  assert.match(route, /MAX_CAPTURE_AGE_MS/);
  assert.match(route, /freshness: "stale"/);
  assert.match(route, /paperOnly: true/);
  assert.doesNotMatch(route, /from\("value_bets"\)/);

  assert.match(client, /data\?\.valueBets/);
  assert.match(client, /cache: "no-store"/);
  assert.match(client, /not showing old value observations/);
});

test("AI Feed has automatic refresh and authenticated community comments", async () => {
  const feed = await file("app/feed/FeedClient.jsx");
  const route = await file("app/api/community/comments/route.js");
  const migration = await file("supabase/scorecaster_community_feed_v1.sql");
  assert.match(feed, /setInterval/);
  assert.match(feed, /\/api\/community\/comments/);
  assert.match(route, /getAuthenticatedContext/);
  assert.match(route, /enforceRateLimit/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
});

test("community comments hide user UUIDs and allow deletion only by the owner", async () => {
  const feed = await file("app/feed/FeedClient.jsx");
  const route = await file("app/api/community/comments/route.js");

  assert.match(route, /function publicComment/);
  assert.match(route, /ownedByViewer/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /Comment was not found or is not owned by this user/);
  assert.match(route, /Links and email addresses are not allowed in comments/);
  assert.doesNotMatch(route, /comments:\s*data\s*\|\|\s*\[\]/);

  assert.match(feed, /comment\.ownedByViewer/);
  assert.match(feed, /method: "DELETE"/);
  assert.match(feed, /Poistetaanko oma kommenttisi pysyvästi/);
  assert.match(feed, /Näytä kaikki \$\{postComments\.length\} kommenttia/);
});

test("ready app keeps real-money execution disabled", async () => {
  const client = await file("app/ScorecasterReadyClient.jsx");
  const route = await file("app/api/scorecaster-app/route.js");
  assert.match(client, /ei aseta vetoja eikä siirrä rahaa/);
  assert.doesNotMatch(route, /placeBet|executeBet|payment|withdraw/i);
});
