import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AUTO_WATCH_SOURCE,
  AUTO_WATCH_VERSION,
  buildAutoWatchRow,
  normalizedAutoWatchPreferences,
  recommendationPassesAutoWatchFilters,
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
    intelligenceV2: { nearPlay: true, nearPlayGate: "verified-evidence" },
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

test("Auto-Watch V2 normalizes bounded user filters", () => {
  const prefs = normalizedAutoWatchPreferences({
    enabled: true,
    top_n: 50,
    selection_mode: "play-only",
    min_score: 120,
    min_edge: 0.9,
    min_ev: 5,
    sport_keys: ["SOCCER_EPL", "soccer_epl", "bad key"]
  });
  assert.equal(prefs.topN, 10);
  assert.equal(prefs.selectionMode, "play-only");
  assert.equal(prefs.minScore, 100);
  assert.equal(prefs.minEdge, 0.2);
  assert.equal(prefs.minEv, 1);
  assert.deepEqual(prefs.sportKeys, ["soccer_epl"]);
});

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

test("PLAY-only mode never auto-watches CAUTION", () => {
  const selected = selectAutoWatchRecommendations([
    recommendation({ eventId: "caution", decision: "CAUTION", score: 99 }),
    recommendation({ eventId: "play", decision: "PLAY", score: 70 })
  ], { enabled: true, top_n: 10, selection_mode: "play-only" });
  assert.deepEqual(selected.map((item) => item.eventId), ["play"]);
});

test("score, edge, EV and sport filters are all fail-closed", () => {
  const prefs = {
    enabled: true,
    top_n: 10,
    min_score: 70,
    min_edge: 0.02,
    min_ev: 0.03,
    sport_keys: ["soccer_epl"]
  };
  assert.equal(recommendationPassesAutoWatchFilters(recommendation(), prefs), true);
  assert.equal(recommendationPassesAutoWatchFilters(recommendation({ score: 69 }), prefs), false);
  assert.equal(recommendationPassesAutoWatchFilters(recommendation({ edge: 0.019 }), prefs), false);
  assert.equal(recommendationPassesAutoWatchFilters(recommendation({ ev: 0.029 }), prefs), false);
  assert.equal(recommendationPassesAutoWatchFilters(recommendation({ sportKey: "basketball_wnba" }), prefs), false);
});

test("Auto-Watch V2 can monitor Top 5 and Top 10 without ever including SKIP", () => {
  const feed = Array.from({ length: 12 }, (_, index) => recommendation({ rank: index + 1, eventId: `event-${index + 1}`, decision: index === 4 ? "SKIP" : "CAUTION" }));
  assert.equal(selectAutoWatchRecommendations(feed, { enabled: true, top_n: 5 }).length, 5);
  const topTen = selectAutoWatchRecommendations(feed, { enabled: true, top_n: 10 });
  assert.equal(topTen.length, 10);
  assert.equal(topTen.some((item) => item.decision === "SKIP"), false);
});

test("Auto-Watch rows remain paper-only and carry V2 filter provenance", () => {
  const row = buildAutoWatchRow(recommendation(), {
    enabled: true,
    top_n: 5,
    alert_move_percent: 0.03,
    alert_before_minutes: 120,
    selection_mode: "play-and-caution",
    min_score: 65,
    min_edge: 0.02,
    min_ev: 0.03,
    sport_keys: ["soccer_epl"]
  }, "00000000-0000-0000-0000-000000000001");

  assert.equal(row.raw_pick.source, AUTO_WATCH_SOURCE);
  assert.equal(row.raw_pick.autoWatchVersion, AUTO_WATCH_VERSION);
  assert.equal(row.raw_pick.paperOnly, true);
  assert.equal(row.raw_pick.realMoneyActionAvailable, false);
  assert.equal(row.raw_pick.nearPlay, true);
  assert.equal(row.raw_pick.nearPlayGate, "verified-evidence");
  assert.equal(row.raw_pick.minScore, 65);
  assert.deepEqual(row.raw_pick.sportKeys, ["soccer_epl"]);
  assert.equal(row.added_decision, "CAUTION");
});

test("manual watchlist rows cover the same selection without being overwritten or deleted", () => {
  const manual = { id: "manual-1", event_id: "event-1", market: "h2h", selection: "Home FC", raw_pick: { source: "scorecaster-live-provider-watchlist" } };
  const plan = reconcileAutoWatchRows({ existingRows: [manual], recommendations: [recommendation()], preferences: { enabled: true, top_n: 1 }, userId: "user-1" });
  assert.equal(plan.coveredByManual, 1);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.deleteIds.length, 0);
});

test("an existing Auto-Watch row is retained so its added-price baseline is not reset", () => {
  const plan = reconcileAutoWatchRows({ existingRows: [autoRow()], recommendations: [recommendation()], preferences: { enabled: true, top_n: 1 }, userId: "user-1" });
  assert.equal(plan.retainedAuto, 1);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.deleteIds.length, 0);
});

test("filter changes remove only stale auto-managed rows", () => {
  const staleAuto = autoRow({ id: "stale-auto", event_id: "old-event", selection: "Old FC" });
  const manual = { id: "manual-keep", event_id: "manual-event", market: "h2h", selection: "Manual FC", raw_pick: { source: "scorecaster-live-provider-watchlist" } };
  const plan = reconcileAutoWatchRows({
    existingRows: [staleAuto, manual],
    recommendations: [recommendation({ eventId: "new-event", selection: "New FC", score: 80 })],
    preferences: { enabled: true, top_n: 1, min_score: 75 },
    userId: "user-1"
  });
  assert.deepEqual(plan.deleteIds, ["stale-auto"]);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.deleteIds.includes("manual-keep"), false);
});

test("disabling Auto-Watch removes only Auto-Watch-owned rows", () => {
  const plan = reconcileAutoWatchRows({
    existingRows: [autoRow({ id: "auto-remove" }), { id: "manual-keep", event_id: "manual-event", market: "h2h", selection: "Manual FC", raw_pick: { source: "scorecaster-live-provider-watchlist" } }],
    recommendations: [],
    preferences: { enabled: false, top_n: 3 },
    userId: "user-1"
  });
  assert.deepEqual(plan.deleteIds, ["auto-remove"]);
});

test("V2 production SQL forces RLS and isolates RPC privileges", async () => {
  const sql = await readFile(new URL("./apply-auto-watch-recommendations-v2.sql", import.meta.url), "utf8");
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /top_n between 1 and 10/i);
  assert.match(sql, /selection_mode in \('play-only', 'play-and-caution'\)/i);
  assert.match(sql, /revoke execute[\s\S]*claim_auto_watch_recommendation_users_v2[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute[\s\S]*claim_auto_watch_recommendation_users_v2[\s\S]*to service_role/i);
  assert.match(sql, /set_auto_watch_recommendation_preferences_v2[\s\S]*to authenticated/i);
});

test("authenticated V2 API is origin protected, bounded and syncs immediately", async () => {
  const route = await readFile(new URL("../app/api/cloud/auto-watch-recommendations/route.js", import.meta.url), "utf8");
  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /mutationOriginAllowed\(request\)/);
  assert.match(route, /bucket:\s*"auto_watch_write"/);
  assert.match(route, /max:\s*10/);
  assert.match(route, /set_auto_watch_recommendation_preferences_v2/);
  assert.match(route, /p_selection_mode/);
  assert.match(route, /p_min_score/);
  assert.match(route, /p_min_edge/);
  assert.match(route, /p_min_ev/);
  assert.match(route, /p_sport_keys/);
  assert.match(route, /syncAutoWatchRecommendations/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(route, /placeBet|suggestedStake|realMoneyActionAvailable\s*:\s*true/i);
});

test("background worker prefers V2 claim and falls back to V1 registry only when missing", async () => {
  const service = await readFile(new URL("../lib/auto-watch-recommendation-service.js", import.meta.url), "utf8");
  assert.match(service, /claim_auto_watch_recommendation_users_v2/);
  assert.match(service, /claim_auto_watch_recommendation_users/);
  assert.match(service, /selection_mode:\s*claim\.selection_mode/);
  assert.match(service, /min_score:\s*claim\.min_score/);
  assert.match(service, /sport_keys:\s*claim\.sport_keys/);
  assert.match(service, /limit", String\(MAX_RECOMMENDATIONS\)/);
});

test("Today and dedicated Auto-Watch surfaces expose V2 without replacing manual watch controls", async () => {
  const today = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/auto-watch/page.jsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/components/AutoWatchRecommendationsPanel.jsx", import.meta.url), "utf8");
  assert.match(today, /AutoWatchRecommendationsPanel/);
  assert.match(today, /RecommendationAlertCTA/);
  assert.match(page, /AutoWatchRecommendationsPanel/);
  assert.match(panel, /Auto-Watch Recommendations V2/);
  assert.match(panel, /PLAY only/);
  assert.match(panel, /Min score/);
  assert.match(panel, /Min edge/);
  assert.match(panel, /Min EV/);
  assert.match(panel, /Top 10/);
  assert.match(panel, /paper-only/);
  assert.doesNotMatch(panel, /placeBet|suggestedStake|realMoneyActionAvailable\s*=\s*true/i);
});
