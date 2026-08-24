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
    bookmakerCount: 8,
    freshnessLabel: "fresh",
    sportsIntelligence: {
      readiness: { level: "market-only", allowsIndependentPlayEvidence: false },
      conflicts: []
    },
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

test("CAUTION becomes a high-severity PLAY-ready alert only after the server decision upgrades", () => {
  const result = buildWatchlistState({
    items: [watched({ added_decision: "CAUTION", added_odds: 2.05 })],
    currentPicks: [current({
      productDecision: "PLAY",
      odds: 2.18,
      edge: 0.028,
      ev: 0.061,
      confidence: 0.82,
      bookmakerCount: 10,
      sportsIntelligence: {
        readiness: { level: "verified", allowsIndependentPlayEvidence: true },
        conflicts: []
      }
    })],
    now: NOW
  });

  const alert = result.alerts.find((item) => item.type === "decision_changed" && /all Scorecaster gates passed/i.test(item.title));
  assert.ok(alert);
  assert.equal(alert.severity, "high");
  assert.equal(alert.addedDecision, "CAUTION");
  assert.equal(alert.currentDecision, "PLAY");
  assert.match(alert.message, /paper-only/i);
});

test("strong market value stays CAUTION and emits an evidence blocker when independent evidence is not verified", () => {
  const result = buildWatchlistState({
    items: [watched({ added_decision: "CAUTION", added_odds: 5.7 })],
    currentPicks: [current({
      odds: 5.85,
      productDecision: "CAUTION",
      consensusProbability: 0.1928,
      edge: 0.0219,
      ev: 0.1279,
      confidence: 0.95,
      bookmakerCount: 16,
      freshnessLabel: "fresh",
      sportsIntelligence: {
        readiness: { level: "market-only", allowsIndependentPlayEvidence: false },
        conflicts: []
      }
    })],
    now: NOW
  });

  const blocker = result.alerts.find((item) => /independent evidence is not verified/i.test(item.title));
  assert.ok(blocker);
  assert.equal(blocker.severity, "medium");
  assert.match(blocker.message, /kept the selection at CAUTION/i);
  assert.equal(result.items[0].current.marketGateReady, true);
  assert.equal(result.items[0].current.evidenceVerified, false);
});

test("verified evidence cannot override a final safety block", () => {
  const result = buildWatchlistState({
    items: [watched({ added_decision: "CAUTION" })],
    currentPicks: [current({
      productDecision: "CAUTION",
      marketDecisionBeforeSafetyGate: "BET",
      edge: 0.035,
      ev: 0.07,
      confidence: 0.9,
      bookmakerCount: 12,
      sportsIntelligence: {
        readiness: { level: "verified", allowsIndependentPlayEvidence: true },
        conflicts: [{ code: "lineup-conflict" }]
      }
    })],
    now: NOW
  });

  const blocker = result.alerts.find((item) => /final safety check/i.test(item.title));
  assert.ok(blocker);
  assert.equal(blocker.severity, "high");
  assert.equal(result.items[0].current.decision, "CAUTION");
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

test("native app exposes watchlist through the More hub and does not create a paper stake", async () => {
  const app = await readFile(new URL("../mobile/src/App.tsx", import.meta.url), "utf8");
  const more = await readFile(new URL("../mobile/src/screens/MoreScreen.tsx", import.meta.url), "utf8");
  const picks = await readFile(new URL("../mobile/src/screens/PicksScreen.tsx", import.meta.url), "utf8");
  const watch = await readFile(new URL("../mobile/src/screens/WatchlistScreen.tsx", import.meta.url), "utf8");
  const tabBlock = app.slice(app.indexOf("const tabs"), app.indexOf("function chooseTab"));

  assert.match(tabBlock, /key:\s*"more"/);
  assert.doesNotMatch(tabBlock, /key:\s*"watchlist"/);
  assert.match(app, /tab === "watchlist" && <WatchlistScreen/);
  assert.match(more, /tab:\s*"watchlist"/);
  assert.match(picks, /"\/api\/cloud\/watchlist"/);
  assert.match(picks, /No stake was created/);
  assert.match(watch, /method:\s*"PATCH"/);
  assert.match(watch, /method:\s*"DELETE"/);
});
