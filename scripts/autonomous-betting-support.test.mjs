import test from "node:test";
import assert from "node:assert/strict";
import { buildBetDecision, buildAutonomousBettingBoard } from "../lib/autonomous-betting-support.mjs";

const now=Date.parse("2026-07-28T12:00:00Z");
const rows=[
 {eventId:"game-1",sourceId:"book-a",metric:"best_odds",value:2.2,observedAt:"2026-07-28T11:50:00Z",confidence:.92,sourceTrust:.9},
 {eventId:"game-1",sourceId:"book-b",metric:"market_probability",value:.46,observedAt:"2026-07-28T11:50:00Z",confidence:.9,sourceTrust:.92},
 {eventId:"game-1",sourceId:"model",metric:"model_probability",value:.54,observedAt:"2026-07-28T11:50:00Z",confidence:.88,sourceTrust:.88},
 {eventId:"game-1",sourceId:"stats",metric:"xg",value:1.8,observedAt:"2026-07-28T11:45:00Z",confidence:.9,sourceTrust:.9},
 {eventId:"game-1",sourceId:"stats",metric:"form_score",value:.7,observedAt:"2026-07-28T11:45:00Z",confidence:.9,sourceTrust:.9},
 {eventId:"game-1",sourceId:"lineup",metric:"lineup_strength",value:.8,observedAt:"2026-07-28T11:40:00Z",confidence:.86,sourceTrust:.9},
 {eventId:"game-1",sourceId:"injury",metric:"injury_impact",value:.1,observedAt:"2026-07-28T11:40:00Z",confidence:.84,sourceTrust:.88},
 {eventId:"game-1",sourceId:"weather",metric:"weather_impact",value:0,observedAt:"2026-07-28T11:35:00Z",confidence:.8,sourceTrust:.85},
 {eventId:"game-1",sourceId:"news",metric:"sentiment",value:.1,observedAt:"2026-07-28T11:35:00Z",confidence:.8,sourceTrust:.82},
 {eventId:"game-1",sourceId:"book-a",metric:"opening_odds",value:2.1,observedAt:"2026-07-28T08:00:00Z",confidence:.9,sourceTrust:.9},
 {eventId:"game-1",sourceId:"model",metric:"simulation_probability",value:.53,observedAt:"2026-07-28T11:30:00Z",confidence:.86,sourceTrust:.87},
 {eventId:"game-1",sourceId:"stats",metric:"pace",value:1,observedAt:"2026-07-28T11:30:00Z",confidence:.8,sourceTrust:.85}
];

test("creates a human decision-support recommendation with price controls",()=>{
 const d=buildBetDecision(rows,{bankroll:1000,now});
 assert.equal(d.eventId,"game-1");
 assert.equal(d.decision,"PLAY");
 assert.ok(d.minimumOdds>1);
 assert.ok(d.expectedValue>0);
 assert.ok(d.suggestedStake>0&&d.suggestedStake<=10);
 assert.equal(d.safety.humanActionRequired,true);
 assert.equal(d.safety.automaticRealMoneyExecution,false);
});

test("blocks weak or stale betting evidence",()=>{
 const d=buildBetDecision(rows.slice(0,2),{bankroll:1000,now:now+48*3600000});
 assert.equal(d.decision,"SKIP");
 assert.ok(d.blockers.length>0);
});

test("board remains human decision support while exposing learning blockers",()=>{
 const board=buildAutonomousBettingBoard({records:rows,bankroll:1000,settled:[],collectorHealth:{status:"healthy"},now});
 assert.equal(board.mode,"human-decision-support");
 assert.ok(board.globalBlockers.includes("learning-sample-below-300"));
 assert.equal(board.safety.humanActionRequired,true);
 assert.equal(board.safety.realMoneyExecution,false);
});
