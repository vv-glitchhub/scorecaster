import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildWatchlistState } from "../lib/watchlist-alert-engine.mjs";

const NOW = Date.parse("2026-07-17T12:00:00Z");

function watched(overrides = {}) {
  return {
    id: "watch-1",
    event_id: "event-1",
    sport: "soccer_epl",
    market: "h2h",
    selection: "Home FC",
    match: "Home FC – Away FC",
    commence_time: "2026-07-17T13:00:00Z",
    added_odds: 2.2,
    added_decision: "PLAY",
    alert_move_percent: 0.05,
    alert_before_minutes: 120,
    active: true,
    ...overrides
  };
}

function current(overrides = {}) {
  return {
    id: "event-1",
    eventId: "event-1",
    sportKey: "soccer_epl",
    marketKey: "h2h",
    selection: "Home FC",
    match: "Home FC – Away FC",
    commenceTime: "2026-07-17T13:00:00Z",
    odds: 1.95,
    productDecision: "CAUTION",
    consensusProbability: 0.52,
    edge: 0.01,
    ev: 0.014,
    confidence: 0.7,
    trustScore: 72,
    ...overrides
  };
}

test("verified watchlist detects kickoff, decision and price changes", () => {
  const result = buildWatchlistState({ items: [watched()], currentPicks: [current()], now: NOW });
  const types = new Set(result.alerts.map((item) => item.type));

  assert.equal(result.summary.watched, 1);
  assert.equal(result.summary.active, 1);
  assert.ok(types.has("kickoff_soon"));
  assert.ok(types.has("decision_changed"));
  assert.ok(types.has("price_moved"));
  assert.ok(types.has("below_play_price"));
  assert.equal(result.items[0].current.decision, "CAUTION");
  assert.equal(result.items[0].oddsMove < 0, true);
});

test("missing current market stays unavailable instead of inventing replacement data", () => {
  const result = buildWatchlistState({ items: [watched()], currentPicks: [], now: NOW });
  const unavailable = result.alerts.find((item) => item.type === "market_unavailable");

  assert.ok(unavailable);
  assert.match(unavailable.message, /No replacement data was invented/i);
  assert.equal(result.items[0].current, null);
});

test("paused items remain stored but do not emit active alerts", () => {
  const result = buildWatchlistState({
    items: [watched({ active: false })],
    currentPicks: [current()],
    now: NOW
  });

  assert.equal(result.summary.watched, 1);
  assert.equal(result.summary.active, 0);
  assert.equal(result.alerts.length, 0);
});

test("watchlist API authenticates, rate-limits and verifies client selections on the server", async () => {
  const route = await readFile(new URL("../app/api/cloud/watchlist/route.js", import.meta.url), "utf8");
  const authIndex = route.indexOf("getAuthenticatedContext(request)");
  const topPicksIndex = route.indexOf("getTopPicks(new Request");
  const matchIndex = route.indexOf("currentPicks.find((item) => sameSelection");
  const upsertIndex = route.indexOf(".upsert(row");

  assert.ok(authIndex >= 0);
  assert.ok(topPicksIndex > authIndex);
  assert.ok(matchIndex > topPicksIndex);
  assert.ok(upsertIndex > matchIndex);
  assert.match(route, /mutationOriginAllowed\(request\)/);
  assert.match(route, /bucket:\s*"watchlist_read"/);
  assert.match(route, /bucket:\s*"watchlist_write"/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /not present in the current verified live-provider analysis/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("watchlist migration forces RLS and isolates rows by auth uid", async () => {
  const migration = await readFile(new URL("../supabase/scorecaster_watchlist_alerts.sql", import.meta.url), "utf8");

  assert.match(migration, /alter table public\.watchlist_items enable row level security/i);
  assert.match(migration, /alter table public\.watchlist_items force row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/i);
  assert.match(migration, /revoke all on public\.watchlist_items from anon/i);
  assert.match(migration, /unique index[\s\S]*user_id, event_id, market, selection/i);
});

test("account export and deletion cover watchlist rows", async () => {
  const exportRoute = await readFile(new URL("../app/api/account/export/route.js", import.meta.url), "utf8");
  const accountRoute = await readFile(new URL("../app/api/account/route.js", import.meta.url), "utf8");

  assert.match(exportRoute, /\.from\("watchlist_items"\)/);
  assert.match(exportRoute, /watchlist:\s*watchlistResult/);
  assert.match(exportRoute, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(accountRoute, /"watchlist_items"/);
  assert.match(accountRoute, /"verified watchlist"/);
});

test("native app exposes a separate watchlist tab and does not create a paper stake", async () => {
  const app = await readFile(new URL("../mobile/src/App.tsx", import.meta.url), "utf8");
  const picks = await readFile(new URL("../mobile/src/screens/PicksScreen.tsx", import.meta.url), "utf8");
  const watch = await readFile(new URL("../mobile/src/screens/WatchlistScreen.tsx", import.meta.url), "utf8");

  assert.match(app, /key:\s*"watchlist"/);
  assert.match(app, /<WatchlistScreen\s*\/>/);
  assert.match(picks, /"\/api\/cloud\/watchlist"/);
  assert.match(picks, /No stake was created/);
  assert.match(watch, /method:\s*"PATCH"/);
  assert.match(watch, /method:\s*"DELETE"/);
});
