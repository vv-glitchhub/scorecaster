import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CAPTURE_TIER_A,CAPTURE_TIER_B,CAPTURE_TIER_C,
  durableLeagueTier,allowsScheduledHistoricalCapture,
  selectScheduledHistoricalLeagues,selectScheduledHistoricalPicks
} from "../lib/free-tier-league-policy.mjs";
import {
  normalizeVerifiedMatchOutcome,buildVerifiedGamePerformance
} from "../lib/verified-game-performance.mjs";

test("five owned leagues and secondary coverage remain durable while all C leagues become live-only", () => {
  assert.equal(CAPTURE_TIER_A.length,5);
  assert.equal(CAPTURE_TIER_B.length,6);
  assert.deepEqual(CAPTURE_TIER_C,["soccer_usa_mls","baseball_mlb","basketball_wnba","soccer_norway_eliteserien"]);
  for(const key of CAPTURE_TIER_A)assert.equal(durableLeagueTier(key),"A");
  for(const key of CAPTURE_TIER_B)assert.equal(durableLeagueTier(key),"B");
  for(const key of CAPTURE_TIER_C) {
    assert.equal(durableLeagueTier(key),"C");
    assert.equal(allowsScheduledHistoricalCapture(key),false);
  }
  assert.equal(allowsScheduledHistoricalCapture("unknown_sport"),false);
});

test("C games remain available to public picks while excluded only from storage", () => {
  const live=[
    {sportKey:"soccer_epl",league:"Premier League",id:"A"},
    {sportKey:"soccer_usa_mls",league:"MLS",id:"C"},
    {sportKey:"icehockey_nhl",league:"NHL",id:"B"},
    {sportKey:"basketball_wnba",league:"WNBA",id:"C2"}
  ];
  const saved=selectScheduledHistoricalPicks(live);
  assert.deepEqual(saved.map(x=>x.id),["A","B"]);
  assert.equal(live.length,4);
  assert.deepEqual(selectScheduledHistoricalLeagues(live.map(x=>x.sportKey)),["soccer_epl","icehockey_nhl"]);
});

test("all scheduled capture routes implement the same league policy",async()=>{
  const files={
    "app/api/internal/collector/route.js":[
      "selectScheduledHistoricalLeagues(activeMarketLeagues(now))",
      "selectScheduledHistoricalPicks(Array.isArray(topPicks?.data)"],
    "app/api/internal/unified-data/route.js":["selectCapturePicks(selectScheduledHistoricalPicks(publicPicks))"],
    "app/api/internal/sports-analytics/route.js":["selectCapturePicks(selectScheduledHistoricalPicks(eligiblePicks)"],
    "app/api/internal/market-microstructure/route.js":["selectScheduledHistoricalLeagues(requested.length ? requested : activeMarketLeagues(now))"]
  };
  for(const [path,needles] of Object.entries(files)){
    const source=await readFile(new URL(`../${path}`,import.meta.url),"utf8");
    for(const needle of needles)assert.ok(source.includes(needle),`${path}: ${needle}`);
  }
  const topPicks=await readFile(new URL("../app/api/top-picks/route.js",import.meta.url),"utf8");
  assert.doesNotMatch(topPicks,/selectScheduledHistoricalPicks/);
});

const verified=(overrides={})=>({
  event_id:"match-123", sport_key:"soccer_epl",home_team:"Home",away_team:"Away",
  commence_time:"2026-10-10T15:00:00Z",captured_at:"2026-10-11T01:00:00Z",
  status:"final",finality_verified:true,home_score:2,away_score:1,...overrides
});

test("verified final produces two genuine home/away match performances",()=>{
  const event=normalizeVerifiedMatchOutcome(verified());
  assert.equal(event.finalVerified,true);
  assert.deepEqual(event.teams.map(x=>[x.team,x.result,x.points,x.goalsFor,x.goalsAgainst]),[
    ["Home","W",3,2,1],["Away","L",0,1,2]
  ]);
  assert.equal(event.expectedGoals,null);
  assert.equal(event.shotsFor,null);
  assert.equal(event.playerStatistics,null);
});

test("unverified, partial, malformed or scheduled results are not fabricated",()=>{
  for(const change of [
    {status:"scheduled"},{finality_verified:false},{home_score:null},{away_score:""},
    {home_score:1.5},{home_score:-1},{commence_time:null},{captured_at:null},
    {home_team:"Away"},{sport_key:""}
  ]) assert.equal(normalizeVerifiedMatchOutcome(verified(change)),null,JSON.stringify(change));
});

test("target cutoff ensures future results never leak into historical features",()=>{
  const payload=buildVerifiedGamePerformance([
    verified({event_id:"early",commence_time:"2026-10-01T15:00:00Z"}),
    verified({event_id:"late",commence_time:"2026-10-13T15:00:00Z"}),
    verified({event_id:"late-arrival",commence_time:"2026-10-05T15:00:00Z",captured_at:"2026-10-14T15:00:00Z"})
  ],{sportKey:"soccer_epl",before:"2026-10-12T12:00:00Z",team:"Home",limit:100});
  assert.equal(payload.gameCount,1);
  assert.equal(payload.teamMatchCount,1);
  assert.equal(payload.games[0].eventId,"early");
  assert.equal(payload.verifiedScoresOnly,true);
  assert.equal(payload.advancedStatisticsAvailable,false);
  assert.ok(payload.missing.includes("xg"));
});

test("game API reads real canonical outcomes only and handles quota failure",async()=>{
  const route=await readFile(new URL("../app/api/game-data/route.js",import.meta.url),"utf8");
  assert.match(route,/scorecaster_event_outcomes_v1/);
  assert.match(route,/\.eq\("finality_verified",true\)/);
  assert.match(route,/\.eq\("status","final"\)/);
  assert.match(route,/query = query\.lt\("commence_time",before\)\.lt\("captured_at",before\)/);
  assert.match(route,/\.limit\(Math\.min\(1000,requestedLimit\*5\)\)/);
  assert.match(route,/restrictedSupabaseResponse\("Verified game data"\)/);
  assert.match(route,/queryBounded:true/);
  assert.doesNotMatch(route,/\.upsert\(|\.insert\(|\.delete\(/);
});
