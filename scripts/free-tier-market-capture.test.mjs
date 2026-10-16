import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FREE_TIER_MARKET_CAPTURE_BUDGET,
  selectFreeTierMarketCapture
} from "../lib/free-tier-market-capture.mjs";
import { OWNED_FOOTBALL_LEAGUES } from "../lib/active-market-universe.js";

const now = "2026-10-16T10:00:00.000Z";
const game = (id, hours = 2, bookmakers = 10) => ({
  id,
  commence_time: new Date(Date.parse(now) + hours * 3600000).toISOString(),
  bookmakers: Array.from({ length: bookmakers }, (_, index) => ({
    key: "bookmaker-" + index,
    markets: [{ key: "h2h", outcomes: [{ name: "Home", price: 1.9 }, { name: "Away", price: 2 }] }]
  }))
});
const group = (sport, count = 7) => ({
  sport,
  games: Array.from({ length: count }, (_, i) => game(`${sport}-${i}`, 5 + count - i))
});
const count = (outcome) => [...outcome.selectedBySport.values()].reduce((sum, games) => sum + games.length, 0);

test("free-tier capture cannot alter live discovery or mutate provider payloads", () => {
  const inputs = [group("soccer_epl", 4), group("icehockey_nhl", 3)];
  const saved = structuredClone(inputs);
  const result = selectFreeTierMarketCapture(inputs, { now });
  assert.deepEqual(inputs, saved);
  assert.equal(result.storageOnly, true);
  assert.equal(result.historicalDataDeleted, false);
  assert.equal(result.rawPayloadStored, false);
  assert.equal(result.selectedEvents, 4);
  assert.equal(result.selectedBySport.get("soccer_epl")[0].bookmakers.length, 4);
  assert.equal(inputs[0].games[0].bookmakers.length, 10);
  assert.equal(FREE_TIER_MARKET_CAPTURE_BUDGET.maxEventsPerCycle, 12);
});

test("all five owned football leagues get space before non-owned leagues", () => {
  const input = [
    group("americanfootball_nfl"),
    group("icehockey_nhl"),
    ...OWNED_FOOTBALL_LEAGUES.map((sport) => group(sport)),
    group("basketball_nba")
  ];
  const result = selectFreeTierMarketCapture(input, { now });
  assert.equal(result.selectedEvents, 12);
  for (const sport of OWNED_FOOTBALL_LEAGUES) {
    assert.equal(result.selectedBySport.get(sport).length, 2, sport);
  }
  assert.equal([...["americanfootball_nfl","icehockey_nhl","basketball_nba"]]
    .reduce((sum,sport)=>sum+result.selectedBySport.get(sport).length,0),2);
  assert.equal(count(result), 12);
});

test("upcoming games are picked before distant games and after-kickoff games excluded", () => {
  const input = [{sport:"soccer_epl",games:[
    game("late",72),game("past",-1),game("early",2),game("duplicate",4),game("duplicate",3),
    game("missing",2,0)
  ]}];
  const result=selectFreeTierMarketCapture(input,{now});
  assert.deepEqual(result.selectedBySport.get("soccer_epl").map(x=>x.id), ["early","duplicate"]);
  assert.equal(result.selectedBySport.get("soccer_epl").some(x=>x.id==="past"),false);
});

test("non-owned leagues rotate across hourly buckets rather than permanently excluding NHL", () => {
  const input = [...OWNED_FOOTBALL_LEAGUES.map(sport=>group(sport)),group("americanfootball_nfl"),group("basketball_nba"),group("icehockey_nhl")];
  const seen = new Set();
  for(let h=0;h<3;h++) {
    const result=selectFreeTierMarketCapture(input,{now:new Date(Date.parse(now)+h*3600000)});
    for(const sport of ["americanfootball_nfl","basketball_nba","icehockey_nhl"])
      if(result.selectedBySport.get(sport).length)seen.add(sport);
  }
  assert.deepEqual([...seen].sort(),["americanfootball_nfl","basketball_nba","icehockey_nhl"]);
});

test("empty, invalid and strict budgets fail closed", () => {
  assert.equal(selectFreeTierMarketCapture([], {now}).selectedEvents,0);
  assert.equal(selectFreeTierMarketCapture([group("soccer_epl")], {now,budget:{maxEventsPerCycle:0,maxEventsPerLeague:2,maxBookmakersPerEvent:4}}).selectedEvents,0);
  assert.throws(()=>selectFreeTierMarketCapture([],{now:"not-a-date"}),/valid capture time/);
});

test("worker persists only selected fixtures and does not silently delete history", async () => {
  const worker=await readFile(new URL("../app/api/internal/market-microstructure/route.js",import.meta.url),"utf8");
  const position=worker.indexOf("selectFreeTierMarketCapture(results.map");
  const normalized=worker.indexOf("normalizeMarketProviderGames(keepSupportedMarkets(storedGames)");
  assert.ok(position>=0 && normalized>position);
  assert.match(worker,/historyEventsSelected: storagePlan\.selectedEvents/);
  assert.match(worker,/historicalDataDeleted: false/);
  assert.match(worker,/fixtureSnapshotInputs\(storedGames, sport, startedAt\)/);
  assert.match(worker,/await assertSupabaseRestReachable\(admin, "market_capture_runs_v2"\)/);
});
