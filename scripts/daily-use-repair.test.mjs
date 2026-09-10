import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { directoryFixtures, marketCoverage, loadAvailableBatches } from "../lib/live-market-availability.mjs";
import { safeNextPath, loginHref } from "../lib/auth-navigation.mjs";
import { readEventFilters, eventFiltersHref } from "../lib/event-browser-filters.mjs";
import { buildGameCenterEvents, filterGameCenterEvents, summarizeGameCenter } from "../lib/game-center-v1.mjs";
import { fetchJson } from "../lib/client-request.mjs";
import { getTrackedBets, saveTrackedBets, settleTrackedBet } from "../lib/tracking-storage.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const fixture = (id, overrides = {}) => ({
  id, home_team: "North " + id, away_team: "South " + id,
  commence_time: new Date(Date.now() + 3600000).toISOString(),
  bookmakers: [], ...overrides
});

test("the directory includes all 140 fixtures without turning unreviewed games into recommendations", () => {
  const fixtures = directoryFixtures(Array.from({ length: 140 }, (_, i) => fixture("event-" + i)), "soccer_epl", "Premier League");
  const events = buildGameCenterEvents([], fixtures);
  assert.equal(events.length, 140);
  assert.ok(events.every(event => event.primarySelection === null && event.decision === "UNREVIEWED"));
  assert.equal(summarizeGameCenter(events).play, 0);
  assert.equal(filterGameCenterEvents(events, { decision: "CAUTION" }).length, 0);
  assert.equal(filterGameCenterEvents(events, { query: "North event-139" })[0].id, "event-139");
});

test("successful empty leagues and failed providers have different availability", () => {
  assert.equal(marketCoverage([{ ok: true, sportKey: "soccer_epl" }]).allUnavailable, false);
  const unavailable = marketCoverage([{ ok: false, sportKey: "soccer_epl", errorCode: "timeout" }]);
  assert.equal(unavailable.allUnavailable, true);
  assert.equal(unavailable.unavailableLeagues[0].reason, "timeout");
  const partial = marketCoverage([{ ok: true, sportKey: "soccer_epl" }, { ok: false, sportKey: "baseball_mlb" }]);
  assert.equal(partial.partialUpstream, true);
  assert.equal(partial.availableLeagueCount, 1);
  assert.equal(marketCoverage([{ ok: true, marketFallback: true }]).partialUpstream, true);
});

test("one timed-out recommendation batch does not discard a successful batch", async () => {
  const results = await loadAvailableBatches(["good", "timeout"], async key => {
    if (key === "timeout") throw new DOMException("Too slow", "TimeoutError");
    return { ok: true, data: [{ id: "observed" }] };
  });
  assert.equal(results[0].data[0].id, "observed");
  assert.equal(results[1].ok, false);
  assert.equal(results[1].status, 504);
});

test("search, dates and league survive a share URL and a login return path", () => {
  const original = { view: "analysis", league: "soccer_epl", query: "West Ham & 100%", time: "tomorrow", decision: "CAUTION", sort: "edge" };
  const href = eventFiltersHref(original);
  assert.deepEqual(readEventFilters(new URL(href, "https://example.test").searchParams), original);
  assert.equal(new URL(loginHref(href), "https://example.test").searchParams.get("next"), href);
  assert.equal(safeNextPath("/event/id?selection=100%25&returnTo=%2Fevents%3Fq%3DWest%2BHam"), "/event/id?selection=100%25&returnTo=%2Fevents%3Fq%3DWest%2BHam");
});

for (const path of ["https://evil.test", "//evil.test", "/\\evil.test", "/%5cevil.test", "/%2f%2fevil.test", "/%255cevil.test", "/%0a/evil.test", "/login?next=/login", "/api/cloud/bets", "/%61uth/confirm", "/foo/../login"]) {
  test("login return rejects unsafe path " + JSON.stringify(path), () => assert.equal(safeNextPath(path), "/profile"));
}
test("invalid filters are normalized and the directory does not inherit an analysis decision", () => {
  const filters = readEventFilters(new URLSearchParams("league=unsupported&time=unknown&decision=PLAY&sort=edge"));
  assert.equal(filters.league, "");
  assert.equal(filters.time, "all");
  assert.equal(filters.decision, "all");
  assert.equal(filters.sort, "kickoff");
});

test("JSON requests preserve HTTP failure status without exposing backend messages", async t => {
  let count = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    count += 1;
    assert.equal(options.cache, "no-store");
    return Response.json({ ok: false, error: "internal details" }, { status: 401 });
  });
  await assert.rejects(fetchJson("/api/cloud/bets", { method: "POST" }), error => error.status === 401 && !error.message.includes("internal details"));
  assert.equal(count, 1, "writes are not retried automatically");
});

test("malformed success JSON is not accepted as available data", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>unavailable</html>", { status: 200 }));
  await assert.rejects(fetchJson("/api/top-picks"));
});

test("cancelled requests retain cancellation and do not return a result", async t => {
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.signal.aborted, true);
    throw options.signal.reason;
  });
  await assert.rejects(fetchJson("/api/top-picks", { signal: controller.signal }), error => error.name === "AbortError");
});

test("local history ignores malformed storage and saves settlement with closing odds in one write", t => {
  let value = '{"unexpected":true}';
  let writes = 0;
  const oldWindow = globalThis.window, oldStorage = globalThis.localStorage;
  globalThis.window = {};
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => value,
    setItem: (_key, next) => { value = next; writes += 1; }
  } });
  t.after(() => {
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldStorage === undefined) delete globalThis.localStorage; else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: oldStorage });
  });
  assert.deepEqual(getTrackedBets(), []);
  value = '[null, 4, {"id":"pick","result":"pending"}]';
  assert.equal(getTrackedBets().length, 1);
  settleTrackedBet("pick", "win", { closingOdds: 1.95 });
  assert.equal(writes, 1);
  assert.equal(getTrackedBets()[0].closingOdds, 1.95);
  assert.equal(getTrackedBets()[0].result, "win");
  globalThis.localStorage.setItem = () => { throw new Error("Storage full"); };
  assert.throws(() => saveTrackedBets([]), /Storage full/);
  assert.equal(getTrackedBets().length, 1);
});

// Exercise the actual route code with deterministic external provider adapters.
// No network, credentials or live odds are involved in these route regressions.
async function routeHarness(provider) {
  const source = (await read("app/api/top-picks/route.js")).replace(/^import[\s\S]*?;\s*/gm, "").replace("export async function GET", "async function GET");
  const calls = { analysis: [], enrichment: 0, requests: [] };
  const dependencies = {
    SPORTS: [{ leagues: [{ key: "soccer_epl", title: "Premier League" }, { key: "baseball_mlb", title: "MLB" }] }],
    directoryFixtures, marketCoverage,
    isSupportedMarketLeague: key => ["soccer_epl", "baseball_mlb"].includes(key),
    marketSeason: () => "transition",
    topPicksDefaultLeagues: () => ["soccer_epl", "baseball_mlb"],
    isUsableLiveFixture: game => Boolean(game.id && game.home_team && game.away_team && Date.parse(game.commence_time) > Date.now()),
    filterUpcomingPicks: (picks, hours, now) => picks.filter(pick => Date.parse(pick.commenceTime) > now && Date.parse(pick.commenceTime) <= now + hours * 3600000),
    createTopPicksFromGames: ({ games, marketKey, limit }) => {
      calls.analysis.push(games.map(game => game.id));
      return games.slice(0, limit).map(game => ({
        id: game.id + "-" + marketKey, gameId: game.id, homeTeam: game.home_team, awayTeam: game.away_team,
        commenceTime: game.commence_time, selection: game.home_team, marketKey,
        edge: 0.04, ev: 0.1, odds: 2.1, confidence: 0.8, bookmakerCount: 6, freshnessLabel: "fresh"
      }));
    },
    attachOwnedDecisionEvidenceBatch: async picks => { calls.enrichment += 1; return picks; },
    enrichPickWithLiveIntelligence: async pick => pick,
    calculatePickQuality: () => ({ qualityScore: 75, qualityGrade: "A" }),
    evaluateIndependentIntelligenceSafetyV1: () => ({ downgrade: true }),
    fetch: async url => { calls.requests.push(String(url)); return provider(new URL(url)); }
  };
  const GET = new Function(...Object.keys(dependencies), source + "\nreturn GET;")(...Object.values(dependencies));
  return { GET, calls };
}

test("directory route returns every verified fixture and skips all model enrichment", async () => {
  const { GET, calls } = await routeHarness(async () => Response.json({ ok: true, source: "live", data: Array.from({ length: 140 }, (_, i) => fixture("event-" + i)) }));
  const response = await GET(new Request("https://scorecaster.test/api/top-picks?sports=soccer_epl&view=directory"));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.events.length, 140);
  assert.deepEqual(payload.data, []);
  assert.equal(calls.enrichment, 0);
  assert.equal(calls.analysis.length, 0);
  assert.ok(calls.requests.every(url => new URL(url).searchParams.get("markets") === "h2h"));
});

test("event drill-down analyzes an event outside the old 24/36-item ranking cap", async () => {
  const games = Array.from({ length: 140 }, (_, i) => fixture("event-" + i));
  const { GET, calls } = await routeHarness(async () => Response.json({ ok: true, source: "live", data: games }));
  const response = await GET(new Request("https://scorecaster.test/api/top-picks?sports=soccer_epl&eventId=event-139"));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.ok(payload.data.length > 0);
  assert.ok(payload.data.every(pick => pick.gameId === "event-139"));
  assert.ok(calls.analysis.every(ids => ids.length === 1 && ids[0] === "event-139"));
  assert.ok(payload.data.every(pick => pick.productDecision !== "PLAY"), "drill-down preserves the independent evidence gate");
});

test("all-provider failure returns 503 instead of a successful empty result", async () => {
  const { GET } = await routeHarness(async () => Response.json({ ok: false }, { status: 502 }));
  const response = await GET(new Request("https://scorecaster.test/api/top-picks?view=directory"));
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.allUnavailable, true);
});

test("partial provider failure returns available fixtures with missing-league disclosure", async () => {
  const { GET } = await routeHarness(async url => url.searchParams.get("sport") === "soccer_epl"
    ? Response.json({ ok: true, source: "live", data: [fixture("available")] })
    : Response.json({ ok: false }, { status: 502 }));
  const response = await GET(new Request("https://scorecaster.test/api/top-picks?view=directory"));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.events.length, 1);
  assert.equal(payload.partialUpstream, true);
  assert.equal(payload.unavailableLeagues[0].sportKey, "baseball_mlb");
});

test("empty provider results remain valid; invalid event scope is rejected before requesting odds", async () => {
  const { GET, calls } = await routeHarness(async () => Response.json({ ok: true, source: "live", data: [] }));
  const empty = await GET(new Request("https://scorecaster.test/api/top-picks?sports=soccer_epl&view=directory"));
  assert.equal(empty.status, 200);
  const count = calls.requests.length;
  for (const query of ["eventId=event-1", "sports=soccer_epl&view=directory&eventId=event-1", "sports=soccer_epl&eventId=%2Fbad"]) {
    assert.equal((await GET(new Request("https://scorecaster.test/api/top-picks?" + query))).status, 400);
  }
  assert.equal(calls.requests.length, count);
});

test("primary views defer research requests and keep actions behind server verification", async () => {
  const [deferred, home, page, detail, tracking, auth] = await Promise.all([
    read("app/components/DeferredSection.jsx"), read("app/page.jsx"), read("app/event/[eventId]/page.jsx"),
    read("app/event/[eventId]/EventDetailClient.jsx"), read("app/tracking/page.jsx"), read("app/auth/confirm/route.js")
  ]);
  assert.match(deferred, /open \? <div/);
  assert.ok(home.indexOf("<TodayPageClient") < home.indexOf("<DeferredSection"));
  assert.ok(page.indexOf("<EventDetailClient") < page.indexOf("<MatchCenterV5"));
  assert.match(detail, /\/api\/cloud\/bets\/audited/);
  assert.match(detail, /needsLogin/);
  assert.match(tracking, /setStorageMode\("unavailable"\)/);
  assert.match(tracking, /closingOnly && previous\?\.cloudStatus/);
  assert.match(auth, /safeNextPath/);
  assert.doesNotMatch(auth, /encodeURIComponent\(error\.message\)/);
});
