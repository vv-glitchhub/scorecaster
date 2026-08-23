import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Today cards retain verified event identity and only actionable WATCH legs enter the accumulator", async () => {
  const [route, today, events] = await Promise.all([
    read("app/api/scorecaster-app/route.js"),
    read("app/components/TodayPageClient.jsx"),
    read("app/events/EventsClient.jsx")
  ]);

  assert.match(route, /function enrichDailyCards/);
  assert.match(route, /selection: cleanText/);
  assert.match(route, /actionableSelection: Boolean/);
  assert.match(today, /pick\.decision === "WATCH" && pick\.selection/);
  assert.match(today, /\/api\/cloud\/watchlist/);
  assert.match(today, /`\/event\/\$\{encodeURIComponent\(pick\.eventId\)\}/);
  assert.doesNotMatch(today, /scorecaster-today-saved|\/events\?eventId/);
  assert.match(today, /<Link href="\/events"[^>]*>\{tr\(\{ fi: "Näytä kaikki kohteet"/);
  assert.match(events, /Tarkista ja valitse toiminto/);
  assert.match(events, /<Link href=\{href\} className="sc-button-primary/);
  assert.doesNotMatch(events, /addTrackedBet|scorecaster-events|savePaperPick/);
});

test("AI Feed deep-links each observation to its verified event selection", async () => {
  const feed = await read("app/feed/FeedClient.jsx");
  assert.match(feed, /function eventHref\(post\)/);
  assert.match(feed, /query\.set\("selection", post\.selection\)/);
  assert.match(feed, /<Link href=\{eventHref\(post\)\}/);
  assert.doesNotMatch(feed, /\/events\?eventId/);
});

test("My picks is cloud-first with authenticated settlement and a local fallback", async () => {
  const [tracking, cloudRoute] = await Promise.all([
    read("app/tracking/page.jsx"),
    read("app/api/cloud/bets/route.js")
  ]);
  assert.match(tracking, /fetch\("\/api\/cloud\/bets", \{ cache: "no-store" \}\)/);
  assert.match(tracking, /betsResponse\.status === 401/);
  assert.match(tracking, /setStorageMode\("local"\)/);
  assert.match(tracking, /method: "PATCH"/);
  assert.match(tracking, /method: "DELETE"/);
  assert.match(tracking, /\/api\/cloud\/bets\/settle/);
  assert.match(tracking, /local-tracking-migration-v1/);
  assert.match(tracking, /protected user account/);
  assert.match(tracking, /modelProbability: marketOnly \? null/);
  assert.match(tracking, /marketOnly \? raw\.modelProbability : null/);
  assert.match(tracking, /getSafeLocalBets/);
  assert.match(tracking, /betting-consensus\|market-universe-v1\|agent-v11-model-lab\|events/);
  assert.match(cloudRoute, /bet\?\.marketProbability/);
  assert.match(cloudRoute, /modelMode: cleanText/);
});

test("audited and legacy paper saves never relabel market consensus as an independent model", async () => {
  const [route, detail, mobileDetail, mobilePicks, betting, universe, agent] = await Promise.all([
    read("app/api/cloud/bets/audited/route.js"),
    read("app/event/[eventId]/EventDetailClient.jsx"),
    read("mobile/src/screens/EventDetailScreen.tsx"),
    read("mobile/src/screens/PicksScreen.tsx"),
    read("app/betting/BettingClient.jsx"),
    read("app/market-universe/MarketUniverseClient.jsx"),
    read("app/agent/AgentClient.jsx")
  ]);

  assert.match(route, /function independentModelProbability/);
  assert.match(route, /marketOnly \? null/);
  assert.ok(route.indexOf("pick.consensusProbability") < route.indexOf("pick.marketProbability", route.indexOf("entryMarketProbability")));
  assert.match(detail, /modelProbability: null/);
  assert.match(detail, /data\?\.ok === false/);
  assert.match(detail, /setSuccessHref\("\/tracking"\)/);
  assert.match(mobileDetail, /modelProbability: null/);
  assert.match(mobilePicks, /modelProbability: null/);
  assert.match(mobilePicks, /\/api\/cloud\/bets\/audited/);
  assert.match(mobilePicks, /scorecaster-mobile-picks-v4/);
  assert.match(betting, /modelProbability: null,[\s\S]*marketProbability: selection\.consensusProbability \?\? selection\.marketProbability/);
  assert.match(universe, /modelProbability: null,[\s\S]*marketProbability: selection\.consensusProbability \?\? selection\.marketProbability/);
  assert.match(agent, /modelProbability: pick\.independentModelProbability \?\? null/);
  assert.match(agent, /market-consensus-agent-stress/);
});

test("runtime dependencies are pinned and reproducible", async () => {
  const [manifestText, lockText] = await Promise.all([
    read("package.json"),
    read("package-lock.json")
  ]);
  const manifest = JSON.parse(manifestText);
  const lock = JSON.parse(lockText);
  const versions = { ...manifest.dependencies, ...manifest.devDependencies };

  assert.ok(Object.values(versions).every((version) => version !== "latest"));
  assert.equal(lock.packages[""].dependencies["@supabase/supabase-js"], manifest.dependencies["@supabase/supabase-js"]);
  assert.equal(lock.packages[""].dependencies.react, manifest.dependencies.react);
});
