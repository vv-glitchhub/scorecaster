import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("account export includes Auto-Watch preferences and watchlist provenance", async () => {
  const route = await readFile(new URL("../app/api/account/export/route.js", import.meta.url), "utf8");
  assert.match(route, /from\("auto_watch_recommendation_preferences"\)/);
  assert.match(route, /autoWatchRecommendations:/);
  assert.match(route, /watchlist_items[\s\S]*raw_pick/);
  assert.match(route, /Auto-Watch recommendation preferences and provenance/);
});

test("account deletion explicitly covers Auto-Watch preference data", async () => {
  const route = await readFile(new URL("../app/api/account/route.js", import.meta.url), "utf8");
  assert.match(route, /"auto_watch_recommendation_preferences"/);
  assert.match(route, /"Auto-Watch recommendation preferences"/);
  assert.match(route, /for \(const table of USER_TABLES\)/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
});

test("global More menu exposes Recommendation Center and Auto-Watch", async () => {
  const shell = await readFile(new URL("../app/components/AppShell.jsx", import.meta.url), "utf8");
  assert.match(shell, /href:\s*"\/recommendations"/);
  assert.match(shell, /href:\s*"\/auto-watch"/);
  assert.match(shell, /Suosituskeskus/);
  assert.match(shell, /Auto-Watch Top 1–10/);
});

test("Recommendation Center and Today both expose Auto-Watch without removing manual monitoring", async () => {
  const today = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
  const recommendations = await readFile(new URL("../app/recommendations/page.jsx", import.meta.url), "utf8");
  assert.match(today, /<AutoWatchRecommendationsPanel compact/);
  assert.match(today, /<RecommendationAlertCTA/);
  assert.match(recommendations, /<AutoWatchRecommendationsPanel compact/);
  assert.match(recommendations, /<RecommendationsClient/);
});

test("watchlist API exposes provenance and the UI labels Auto-Watch-owned rows", async () => {
  const route = await readFile(new URL("../app/api/cloud/watchlist/route.js", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/watchlist/WatchlistClient.jsx", import.meta.url), "utf8");
  assert.match(route, /const SELECT = "[^"]*raw_pick/);
  assert.match(client, /scorecaster-auto-watch-recommendations-v1/);
  assert.match(client, /AUTO-WATCH/);
  assert.match(client, /autoWatchRank/);
  assert.match(client, /href="\/auto-watch"/);
  assert.match(client, /next sync may add it again|seuraava synkka voi lisätä sen takaisin/i);
});
