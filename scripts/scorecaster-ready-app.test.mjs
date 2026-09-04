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

test("My Picks includes isolated Veikkaus-style external slip tracking", async () => {
  const [layout, tracker, schema, authCloud] = await Promise.all([
    file("app/tracking/layout.jsx"),
    file("app/tracking/ExternalSlipTracker.jsx"),
    file("supabase/scorecaster_schema.sql"),
    file("supabase/scorecaster_auth_cloud.sql")
  ]);

  assert.match(layout, /ExternalSlipTrackerConnected/);
  assert.match(tracker, /data-external-slip-tracker="v1"/);
  assert.match(tracker, /Kokonaiskerroin/);
  assert.match(tracker, /Mahdollinen palautus/);
  assert.match(tracker, /Oikein/);
  assert.match(tracker, /Avoin/);
  assert.match(tracker, /Ei osunut/);
  assert.match(tracker, /from\("bet_slips"\)/);
  assert.match(tracker, /from\("bet_slip_items"\)/);
  assert.match(tracker, /\.eq\("user_id", user\.id\)/);
  assert.doesNotMatch(tracker, /\/api\/cloud\/external-slips/);
  assert.doesNotMatch(tracker, /from\("bets"\)/);
  assert.match(schema, /create table if not exists public\.bet_slips/);
  assert.match(schema, /create table if not exists public\.bet_slip_items/);
  assert.match(authCloud, /'bet_slips'/);
  assert.match(authCloud, /'bet_slip_items'/);
});

test("external slip domain preserves receipt progress without touching paper metrics", async () => {
  const domain = await import(new URL("../lib/external-slip-v1.mjs", import.meta.url));
  const legs = [
    ["Roma v Fiorentina", "Roma", 1.64, "won"],
    ["Fulham v Chelsea", "Chelsea", 1.85, "won"],
    ["Real Madrid v Real Sociedad", "Real Madrid", 1.30, "won"],
    ["FC Barcelona v Athletic Bilbao", "FC Barcelona", 1.31, "won"],
    ["Bayern München v VfB Stuttgart", "Bayern München", 1.28, "won"],
    ["Borussia Dortmund v Hamburger SV", "Borussia Dortmund", 1.35, "won"],
    ["Edmonton Oilers - Vancouver Canucks", "Edmonton Oilers", 1.60, "open"],
    ["Vegas Golden Knights - Chicago Blackhawks", "Vegas Golden Knights", 1.68, "open"],
    ["Olympique Lyonnais v Fenerbahce", "Olympique Lyonnais", 1.94, "lost"],
    ["AEK Athens v Levski Sofia", "AEK Athens", 1.55, "won"]
  ].map(([match, selection, odds, status], index) => ({ id: `leg-${index + 1}`, match, selection, odds, status, market: "Voittaja (1X2)" }));

  const draft = { provider: "Veikkaus", externalReference: "receipt-example", title: "Kuponki", stake: 43.2, combinedOdds: 72.17, potentialReturn: 3117.60, purchasedAt: "2026-08-24", resolvesAt: "2026-09-30", legs, source: "external-slip-reference-v1" };
  const progress = domain.externalSlipProgress(legs);
  assert.deepEqual(progress, { total: 10, open: 2, won: 7, lost: 1, void: 0, push: 0 });
  assert.equal(domain.deriveExternalSlipStatus(legs), "lost");

  const parent = domain.externalSlipParentRow(draft, "00000000-0000-4000-8000-000000000001");
  assert.equal(parent.decision, domain.EXTERNAL_SLIP_DECISION);
  assert.equal(parent.status, "external_lost");
  assert.equal(parent.total_stake, 43.2);
  assert.equal(parent.potential_return, 3117.6);
  assert.equal(parent.warnings.combinedOdds, 72.17);
  assert.equal(parent.warnings.excludedFromPaperPerformance, true);
  assert.equal(parent.warnings.excludedFromAutonomousAgent, true);

  const items = domain.externalSlipItemRows(draft, "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000001");
  assert.equal(items.length, 10);
  assert.ok(items.every((item) => item.stake === 0 && item.edge === null && item.ev === null && item.model_probability === null));
  assert.equal(items[8].decision, "EXTERNAL_LOST");
});
