import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMarketTimeline,
  currentSnapshotFromPick,
  initialSnapshotFromWatchlist,
  materiallyDifferentSnapshot
} from "../lib/market-timeline.mjs";

function row(overrides = {}) {
  return {
    id: "point-1",
    watchlist_id: "watch-1",
    event_id: "event-1",
    sport: "icehockey_nhl",
    league: "NHL",
    market: "h2h",
    selection: "Home Team",
    odds: 2.2,
    decision: "PLAY",
    consensus_probability: 0.49,
    edge: 0.04,
    ev: 0.078,
    confidence: 0.72,
    bookmaker: "Book A",
    source: "server-top-picks",
    captured_at: "2026-07-18T10:00:00Z",
    ...overrides
  };
}

test("timeline sorts verified points and describes a shortened price without outcome inference", () => {
  const result = buildMarketTimeline([
    row({ id: "later", odds: 1.95, decision: "CAUTION", bookmaker: "Book B", captured_at: "2026-07-18T12:00:00Z" }),
    row({ id: "first", odds: 2.2, captured_at: "2026-07-18T10:00:00Z" }),
    row({ id: "middle", odds: 2.05, captured_at: "2026-07-18T11:00:00Z" })
  ]);

  assert.equal(result.status, "ready");
  assert.deepEqual(result.points.map((point) => point.id), ["first", "middle", "later"]);
  assert.equal(result.summary.initialOdds, 2.2);
  assert.equal(result.summary.currentOdds, 1.95);
  assert.equal(result.summary.minimumOdds, 1.95);
  assert.equal(result.summary.maximumOdds, 2.2);
  assert.equal(result.summary.movement, "shortened");
  assert.equal(result.summary.decisionChanges, 1);
  assert.equal(result.summary.bookmakerChanges, 1);
  assert.ok(result.summary.oddsChange < 0);
  assert.ok(result.summary.impliedProbabilityChange > 0);
  assert.match(result.interpretation, /shortened/i);
  assert.equal(result.outcomeInference, false);
  assert.equal(result.sharpMoneyInference, false);
  assert.match(result.limitation, /not evidence of sharp money/i);
});

test("timeline labels lengthening and stability descriptively", () => {
  const lengthened = buildMarketTimeline([
    row({ id: "a", odds: 1.8, captured_at: "2026-07-18T10:00:00Z" }),
    row({ id: "b", odds: 2.0, captured_at: "2026-07-18T11:00:00Z" })
  ]);
  assert.equal(lengthened.summary.movement, "lengthened");
  assert.ok(lengthened.summary.oddsChange > 0);

  const stable = buildMarketTimeline([
    row({ id: "a", odds: 2, captured_at: "2026-07-18T10:00:00Z" }),
    row({ id: "b", odds: 2.003, captured_at: "2026-07-18T11:00:00Z" })
  ]);
  assert.equal(stable.summary.movement, "stable");
});

test("empty and single-point timelines remain safe", () => {
  const empty = buildMarketTimeline([]);
  assert.equal(empty.status, "empty");
  assert.equal(empty.summary.count, 0);
  assert.equal(empty.outcomeInference, false);
  assert.equal(empty.sharpMoneyInference, false);

  const single = buildMarketTimeline([row()]);
  assert.equal(single.status, "single-point");
  assert.equal(single.summary.count, 1);
  assert.equal(single.summary.oddsChange, 0);
});

test("server snapshot builders use verified pick and watchlist fields", () => {
  const watchlist = {
    id: "watch-1",
    user_id: "user-1",
    event_id: "event-1",
    sport: "icehockey_nhl",
    league: "NHL",
    market: "h2h",
    selection: "Home Team",
    added_odds: 2.2,
    added_decision: "PLAY",
    created_at: "2026-07-18T09:00:00Z",
    raw_pick: {
      consensusProbability: 0.49,
      edge: 0.04,
      ev: 0.078,
      confidence: 0.72,
      bookmaker: "Book A"
    }
  };
  const pick = {
    gameId: "event-1",
    sportKey: "icehockey_nhl",
    leagueTitle: "NHL",
    marketKey: "h2h",
    selection: "Home Team",
    odds: 2.05,
    productDecision: "CAUTION",
    consensusProbability: 0.5,
    edge: 0.025,
    ev: 0.025,
    confidence: 0.68,
    bookmaker: "Book B"
  };

  const initial = initialSnapshotFromWatchlist(watchlist);
  const current = currentSnapshotFromPick(pick, watchlist, "2026-07-18T10:00:00Z");
  assert.equal(initial.user_id, "user-1");
  assert.equal(initial.watchlist_id, "watch-1");
  assert.equal(initial.odds, 2.2);
  assert.equal(initial.source, "watchlist-added");
  assert.equal(current.odds, 2.05);
  assert.equal(current.decision, "CAUTION");
  assert.equal(current.bookmaker, "Book B");
  assert.equal(current.source, "server-top-picks");
  assert.equal(current.consensus_probability, 0.5);
});

test("duplicate suppression detects material price, decision, bookmaker and consensus changes", () => {
  const base = row();
  assert.equal(materiallyDifferentSnapshot(base, { ...base }), false);
  assert.equal(materiallyDifferentSnapshot(base, { ...base, odds: 2.21 }), true);
  assert.equal(materiallyDifferentSnapshot(base, { ...base, decision: "WATCH" }), true);
  assert.equal(materiallyDifferentSnapshot(base, { ...base, bookmaker: "Book B" }), true);
  assert.equal(materiallyDifferentSnapshot(base, { ...base, consensus_probability: 0.495 }), true);
});

test("Market Timeline API authenticates, requires owned watchlist and reloads Top Picks", async () => {
  const route = await readFile(new URL("../app/api/cloud/market-timeline/route.js", import.meta.url), "utf8");
  const authIndex = route.indexOf("getAuthenticatedContext(request)");
  const watchIndex = route.indexOf("const watch = await watchlistRow(auth");
  const currentIndex = route.indexOf("const current = await currentPick(request");
  const insertIndex = route.indexOf("market_timeline_snapshots\").insert");

  assert.ok(authIndex >= 0);
  assert.ok(watchIndex > authIndex);
  assert.ok(currentIndex > watchIndex);
  assert.ok(insertIndex > currentIndex);
  assert.match(route, /mutationOriginAllowed\(request\)/);
  assert.match(route, /bucket:\s*"market_timeline_read"/);
  assert.match(route, /bucket:\s*"market_timeline_capture"/);
  assert.match(route, /getTopPicks\(new Request/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /Add the verified selection to your watchlist before capturing prices/);
  assert.doesNotMatch(route, /body\.data\?\.odds/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(route, /ODDS_API_KEY/);
});

test("Market Timeline migration forces RLS and links points to watchlist ownership", async () => {
  const migration = await readFile(new URL("../supabase/scorecaster_market_timeline.sql", import.meta.url), "utf8");
  assert.match(migration, /references public\.watchlist_items\(id\) on delete cascade/i);
  assert.match(migration, /alter table public\.market_timeline_snapshots enable row level security/i);
  assert.match(migration, /alter table public\.market_timeline_snapshots force row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/i);
  assert.match(migration, /revoke all on public\.market_timeline_snapshots from anon/i);
  assert.match(migration, /user_id, event_id, market, selection, captured_at/i);
});

test("web and native clients use the verified timeline API without bookmaker actions", async () => {
  const web = await readFile(new URL("../app/market-timeline/MarketTimelineClient.jsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/market-timeline/TimelinePanel.jsx", import.meta.url), "utf8");
  const mobile = await readFile(new URL("../mobile/src/screens/EventDetailScreen.tsx", import.meta.url), "utf8");

  assert.match(web, /\/api\/cloud\/watchlist/);
  assert.match(web, /\/api\/cloud\/market-timeline/);
  assert.match(web, /Capture current price/);
  assert.match(panel, /Price movement is descriptive market history/);
  assert.doesNotMatch(web, /bookmaker.*href/i);
  assert.match(mobile, /\/api\/cloud\/market-timeline/);
  assert.match(mobile, /Capture current price point/);
  assert.match(mobile, /not an outcome prediction/);
});

test("account export and deletion include Market Timeline rows", async () => {
  const account = await readFile(new URL("../app/api/account/route.js", import.meta.url), "utf8");
  const exportRoute = await readFile(new URL("../app/api/account/export/route.js", import.meta.url), "utf8");
  assert.match(account, /"market_timeline_snapshots"/);
  assert.match(account, /"market timeline"/);
  assert.match(exportRoute, /\.from\("market_timeline_snapshots"\)/);
  assert.match(exportRoute, /marketTimeline:/);
  assert.match(exportRoute, /\.eq\("user_id", auth\.user\.id\)/);
});
