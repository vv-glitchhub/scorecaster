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
  assert.match(shell, /Auto-Watch Top 1–3/);
});

test("Recommendation Center and Today both expose Auto-Watch without removing manual monitoring", async () => {
  const today = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
  const recommendations = await readFile(new URL("../app/recommendations/page.jsx", import.meta.url), "utf8");
  assert.match(today, /<AutoWatchRecommendationsPanel compact/);
  assert.match(today, /<RecommendationAlertCTA/);
  assert.match(recommendations, /<AutoWatchRecommendationsPanel compact/);
  assert.match(recommendations, /<RecommendationsClient/);
});
