import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MARKET_FAMILIES,
  OWNED_FOOTBALL_LEAGUES,
  activeMarketLeagues,
  marketSeason,
  topPicksDefaultLeagues,
} from "../lib/active-market-universe.js";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("home page uses the PLAY-first Today experience", async () => {
  const page = await file("app/page.jsx");
  const today = await file("app/components/TodayPageV3.jsx");
  assert.match(page, /TodayPageClient/);
  const todayIndex = page.indexOf("<TodayPageClient />");
  const spotlightIndex = page.indexOf("<RecommendationSpotlight />");
  const professionalIndex = page.indexOf('<ProfessionalSurfaceRail surface="today" />');
  assert.ok(todayIndex >= 0, "TodayPageClient must be rendered on the home page");
  assert.ok(spotlightIndex < 0 || todayIndex < spotlightIndex, "PLAY-first Today must render before Recommendation Spotlight");
  assert.ok(professionalIndex < 0 || todayIndex < professionalIndex, "PLAY-first Today must render before professional diagnostics");
  assert.match(today, /\/api\/recommendations\?limit=20/);
  assert.match(today, /data-homepage-v3="mobile-first"/);
  assert.match(today, /REAL DATA · PAPER ONLY/);
  assert.match(today, /Dataa\. /);
  assert.match(today, /Parempia päätöksiä/);
  assert.match(today, /Top AI Picks/);
  assert.match(today, /Match Hub/);
  assert.match(today, /independentModelProbability/);
  assert.match(today, /marketProbability/);
  assert.match(today, /Ei PLAY-kohteita juuri nyt/);
  assert.match(today, /AI Feed/);
  assert.match(today, /Paper Slip/);
  assert.match(today, /Ei vedonvälittäjä\. Ei lähetä vetoa eikä siirrä rahaa\./);
  assert.doesNotMatch(today, /\bPlace Bet\b|potential return|Avg\. ROI/i);
});

test("shared market universe keeps the owned football leagues aligned across Sep and Oct", () => {
  const september = Date.parse("2026-09-08T12:00:00Z");
  const october = Date.parse("2026-10-08T12:00:00Z");
  assert.equal(marketSeason(september), "transition");
  assert.equal(marketSeason(october), "transition");
  assert.deepEqual(MARKET_FAMILIES, ["h2h", "spreads", "totals"]);
  const active = activeMarketLeagues(september);
  const bounded = topPicksDefaultLeagues(september, 12);
  for (const league of OWNED_FOOTBALL_LEAGUES) {
    assert.ok(active.includes(league), `${league} missing from active transition universe`);
    assert.ok(bounded.includes(league), `${league} missing from bounded Top Picks universe`);
  }
});

test("Top Picks, recommendations, collector and market capture consume the same universe", async () => {
  const [topPicks, recommendations, collector, marketWorker, health] = await Promise.all([
    file("app/api/top-picks/route.js"),
    file("app/api/recommendations/route.js"),
    file("app/api/internal/collector/route.js"),
    file("app/api/internal/market-microstructure/route.js"),
    file("app/api/health/route.js"),
  ]);
  assert.match(topPicks, /topPicksDefaultLeagues/);
  assert.match(topPicks, /marketSeason/);
  assert.doesNotMatch(topPicks, /CORE_SEASON_DEFAULT_LEAGUES|TRANSITION_DEFAULT_LEAGUES/);
  assert.match(recommendations, /activeMarketLeagues/);
  assert.doesNotMatch(recommendations, /FALLBACK_ACTIVE_SPORTS\s*=\s*\[/);
  assert.match(collector, /activeMarketLeagues/);
  assert.doesNotMatch(collector, /FALLBACK_LEAGUES\s*=\s*\[/);
  assert.match(marketWorker, /activeMarketLeagues/);
  assert.match(marketWorker, /fixtureSnapshotInputs/);
  assert.match(marketWorker, /capturedAlongsideMarketMicrostructure:\s*true/);
  assert.match(marketWorker, /rawPayloadStored:\s*false/);
  assert.match(marketWorker, /realMoneyExecution:\s*false/);
  assert.match(health, /sportsIntelligenceMaxEnrichmentsPerTopPicksRequest:\s*24/);
  assert.match(health, /recommendationNoForcedPlay:\s*true/);
  assert.match(health, /intelligenceCoreVerifiedOutcomeLearning:\s*true/);
  assert.match(health, /intelligenceCoreAutomaticModelPromotionAllowed:\s*false/);
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