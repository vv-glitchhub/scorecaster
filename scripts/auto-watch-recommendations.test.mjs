import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AUTO_WATCH_SOURCE,
  buildAutoWatchRow,
  reconcileAutoWatchRows,
  selectAutoWatchRecommendations
} from "../lib/auto-watch-recommendations.mjs";

function recommendation(overrides = {}) {
  return {
    rank: 1,
    eventId: "event-1",
    sportKey: "soccer_epl",
    league: "Premier League",
    marketKey: "h2h",
    selection: "Home FC",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    match: "Home FC – Away FC",
    commenceTime: "2026-08-30T17:00:00Z",
    odds: 2.2,
    fairOdds: 2.05,
    minimumEvOdds: 2.112,
    evPriceGateOpen: true,
    decision: "CAUTION",
    score: 74,
    edge: 0.025,
    ev: 0.06,
    confidence: 0.72,
    trustScore: 82,
    bookmaker: "Example",
    bookmakerCount: 10,
    readiness: "market-only",
    nextGate: { code: "verified-evidence", status: "blocked" },
    ...overrides
  };
}

function autoRow(overrides = {}) {
  return {
    id: "watch-auto-1",
    event_id: "event-1",
    market: "h2h",
    selection: "Home FC",
    raw_pick: { source: AUTO_WATCH_SOURCE },
    ...overrides
  };
}

test("Auto-Watch selects only bounded PLAY/CAUTION recommendations", () => {
  const selected = selectAutoWatchRecommendations([
    recommendation({ rank: 1, eventId: "play", decision: "PLAY" }),
    recommendation({ rank: 2, eventId: "caution", decision: "CAUTION" }),
    recommendation({ rank: 3, eventId: "skip", decision: "SKIP" }),
    recommendation({ rank: 4, eventId: "extra", decision: "CAUTION" })
  ], { enabled: true, top_n: 3 });

  assert.deepEqual(selected.map((item) => item.eventId), ["play", "caution", "extra"]);
  assert.equal(selected.some((item) => item.decision === "SKIP"), false);
});

test("Auto-Watch rows remain paper-only and carry recommendation provenance", () => {
  const row = buildAutoWatchRow(recommendation(), {
    enabled: true,
    top_n: 3,
    alert_move_percent: 0.03,
    alert_before_minutes: 120
  }, "00000000-0000-0000-0000-000000000001");

  assert.equal(row.raw_pick.source, AUTO_WATCH_SOURCE);
  assert.equal(row.raw_pick.paperOnly, true);
  assert.equal(row.raw_pick.realMoneyActionAvailable, false);
  assert.equal(row.added_decision, "CAUTION");
  assert.equal(row.alert_move_percent, 0.03);
});

test("manual watchlist rows cover the same selection without being overwritten or deleted", () => {
  const manual = {
    id: "manual-1",
    event_id: "event-1",
    market: "h2h",
    selection: "Home FC",
    raw_pick: { source: "scorecaster-live-provider-watchlist" }
  };
  const plan = reconcileAutoWatchRows({
    existingRows: [manual],
    recommendations: [recommendation()],
    preferences: { enabled: true, top_n: 1 },
    userId: "user-1"
  });

  assert.equal(plan.coveredByManual, 1);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.deleteIds.length, 0);
});

test("an existing Auto-Watch row is retained so its added-price baseline is not reset", () => {
  const plan = reconcileAutoWatchRows({
    existingRows: [autoRow()],
    recommendations: [recommendation()],
    preferences: { enabled: true, top_n: 1 },
    userId: "user-1"
  });

  assert.equal(plan.retainedAuto, 1);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.deleteIds.length, 0);
});

test("ranking rotation removes only stale auto-managed rows", () => {
  const staleAuto = autoRow({ id: "stale-auto", event_id: "old-event", selection: "Old FC" });
  const manual = {
    id: "manual-keep",
    event_id: "manual-event",
    market: "h2h",
    selection: "Manual FC",
    raw_pick: { source: "scorecaster-live-provider-watchlist" }
  };
  const plan = reconcileAutoWatchRows({
    existingRows: [staleAuto, manual],
    recommendations: [recommendation({ eventId: "new-event", selection: "New FC" })],
    preferences: { enabled: true, top_n: 1 },
    userId: "user-1"
  });

  assert.deepEqual(plan.deleteIds, ["stale-auto"]);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.deleteIds.includes("manual-keep"), false);
});

test("disabling Auto-Watch removes only Auto-Watch-owned rows", () => {
  const plan = reconcileAutoWatchRows({
    existingRows: [
      autoRow({ id: "auto-remove" }),
      {
        id: "manual-keep",
        event_id: "manual-event",
        market: "h2h",
        selection: "Manual FC",
        raw_pick: { source: "scorecaster-live-provider-watchlist" }
      }
    ],
    recommendations: [],
    preferences: { enabled: false, top_n: 3 },
    userId: "user-1"
  });

  assert.deepEqual(plan.deleteIds, ["auto-remove"]);
});

test("database patch forces RLS and isolates worker RPC privileges", async () => {
  const sql = await readFile(new URL("./apply-auto-watch-recommendations-v1.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.auto_watch_recommendation_preferences force row level security/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /interval '10 minutes'/i);
  assert.match(sql, /interval '15 minutes'/i);
  assert.match(sql, /revoke execute[\s\S]*claim_auto_watch_recommendation_users[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute[\s\S]*claim_auto_watch_recommendation_users[\s\S]*to service_role/i);
  assert.match(sql, /set_auto_watch_recommendation_preferences[\s\S]*to authenticated/i);
});

test("authenticated API is origin protected, rate limited and syncs recommendations immediately", async () => {
  const route = await readFile(new URL("../app/api/cloud/auto-watch-recommendations/route.js", import.meta.url), "utf8");
  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /mutationOriginAllowed\(request\)/);
  assert.match(route, /bucket:\s*"auto_watch_read"/);
  assert.match(route, /bucket:\s*"auto_watch_write"/);
  assert.match(route, /set_auto_watch_recommendation_preferences/);
  assert.match(route, /currentRecommendations\(request\)/);
  assert.match(route, /syncAutoWatchRecommendations/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(route, /placeBet|suggestedStake|realMoneyActionAvailable\s*:\s*true/i);
});

test("background worker reconciles Auto-Watch before normal watchlist alert processing", async () => {
  const route = await readFile(new URL("../app/api/internal/watchlist-monitor/route.js", import.meta.url), "utf8");
  const autoIndex = route.indexOf("autoWatch = await runAutoWatchRecommendationSync");
  const monitorIndex = route.indexOf("const result = await runWatchlistMonitor");
  assert.ok(autoIndex >= 0);
  assert.ok(monitorIndex > autoIndex);
  assert.match(route, /watchlistMonitorAuthorizationValid/);
  assert.match(route, /autoWatch = \{[\s\S]*ok: false/);
});

test("Today and dedicated Auto-Watch surfaces exist without replacing manual watch controls", async () => {
  const today = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/auto-watch/page.jsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/components/AutoWatchRecommendationsPanel.jsx", import.meta.url), "utf8");
  assert.match(today, /AutoWatchRecommendationsPanel/);
  assert.match(today, /RecommendationAlertCTA/);
  assert.match(page, /AutoWatchRecommendationsPanel/);
  assert.match(panel, /paper-only/);
  assert.match(panel, /\/api\/cloud\/auto-watch-recommendations/);
  assert.doesNotMatch(panel, /placeBet|suggestedStake|realMoneyActionAvailable\s*=\s*true/i);
});
