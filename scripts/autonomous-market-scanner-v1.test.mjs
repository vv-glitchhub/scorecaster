import assert from "node:assert/strict";
import {
  AUTONOMOUS_MARKET_SCANNER_V1,
  autonomousMarketGroupForEvent,
  autonomousMarketScanPlan,
  marketUniverseSelectionToAgentCandidate,
  mergeAutonomousMarketCandidates,
  scanAutonomousMarketUniverse,
  shouldRunAutonomousMarketScan
} from "../lib/autonomous-market-scanner-v1.mjs";
import { buildAgentV9Portfolio } from "../lib/agent-v9-engine.mjs";

const clock = new Date("2026-08-20T20:00:00.000Z");
const seed = {
  id: "evt-1-h2h-home",
  gameId: "evt-1",
  sportKey: "soccer_epl",
  sportTitle: "EPL",
  league: "soccer_epl",
  leagueTitle: "EPL",
  commenceTime: "2026-08-21T18:00:00.000Z",
  match: "Arsenal vs Chelsea",
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  marketKey: "h2h",
  selection: "Arsenal",
  odds: 2.1,
  consensusProbability: 0.5,
  marketProbability: 1 / 2.1,
  edge: 0.5 - 1 / 2.1,
  ev: 2.1 * 0.5 - 1,
  confidence: 0.82,
  trustScore: 82,
  bookmakerCount: 8,
  probabilityDispersion: 0.01,
  freshnessLabel: "fresh",
  lastUpdate: "2026-08-20T19:55:00.000Z",
  productDecision: "PLAY",
  sportsIntelligence: { readiness: { level: "verified" } },
  lineup: { startersConfirmed: true },
  injuries: [{ source: "verified" }],
  newsItems: [{ source: "verified" }]
};

assert.equal(AUTONOMOUS_MARKET_SCANNER_V1.paperOnly, true);
assert.equal(AUTONOMOUS_MARKET_SCANNER_V1.probabilityChangedByScanner, false);
assert.equal(shouldRunAutonomousMarketScan(clock), true);
assert.equal(shouldRunAutonomousMarketScan(new Date("2026-08-20T20:15:00.000Z")), false);
assert.equal(autonomousMarketGroupForEvent("soccer_epl", clock, 0), autonomousMarketGroupForEvent("soccer_epl", clock, 0));

const plan = autonomousMarketScanPlan([
  seed,
  { ...seed, selection: "Draw" },
  { ...seed, gameId: "evt-2", id: "evt-2-home", match: "Liverpool vs Spurs", homeTeam: "Liverpool", awayTeam: "Spurs" },
  { ...seed, gameId: "evt-3", id: "evt-3-home", match: "City vs Villa", homeTeam: "City", awayTeam: "Villa" },
  { ...seed, gameId: "evt-4", id: "evt-4-home", match: "United vs Everton", homeTeam: "United", awayTeam: "Everton" }
], { now: clock, maxEventsPerScan: 3 });
assert.equal(plan.events.length, 3);
assert.equal(new Set(plan.events.map((item) => item.eventId)).size, 3);
assert.ok(plan.events.every((item) => item.group));

const teamGoal = marketUniverseSelectionToAgentCandidate({
  event: {
    id: "evt-1",
    sportKey: "soccer_epl",
    sportTitle: "EPL",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    commenceTime: seed.commenceTime
  },
  market: { key: "team_totals", title: "Team totals" },
  unit: { key: "subject:arsenal:0.5", label: "Arsenal 0.5", point: 0.5 },
  selection: {
    selection: "Arsenal · Over · 0.5",
    point: 0.5,
    odds: 1.72,
    bestOdds: 1.72,
    fairOdds: 1.52,
    bookmaker: "Book A",
    bookmakerKey: "book-a",
    consensusProbability: 0.66,
    marketProbability: 1 / 1.72,
    edge: 0.66 - 1 / 1.72,
    ev: 1.72 * 0.66 - 1,
    confidence: 0.86,
    bookmakerCount: 8,
    probabilityDispersion: 0.008,
    freshnessLabel: "fresh",
    latestUpdate: "2026-08-20T19:59:00.000Z",
    decision: "PLAY",
    decisionReason: "eligible",
    analysisEligible: true
  },
  seed
});
assert.ok(teamGoal);
assert.equal(teamGoal.marketKey, "team_totals");
assert.equal(teamGoal.point, 0.5);
assert.equal(teamGoal.productDecision, "PLAY");
assert.equal(teamGoal.modelProbability, 0.66);
assert.equal(teamGoal.baselineProbability, 0.66);
assert.equal(teamGoal.probabilityAdjustedByScanner, false);
assert.equal(teamGoal.paperOnly, true);
assert.deepEqual(teamGoal.sportsIntelligence, seed.sportsIntelligence);

const priceOnly = marketUniverseSelectionToAgentCandidate({
  event: { id: "evt-1", sportKey: "soccer_epl" },
  market: { key: "correct_score" },
  unit: { key: "main" },
  selection: { selection: "1-0", odds: 8, consensusProbability: 0.12, decision: "PRICE_ONLY", analysisEligible: false },
  seed
});
assert.equal(priceOnly, null);

const mockUniverse = {
  ok: true,
  event: {
    id: "evt-1",
    sportKey: "soccer_epl",
    sportTitle: "EPL",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    commenceTime: seed.commenceTime
  },
  markets: [{
    key: "team_totals",
    title: "Team totals",
    units: [{
      key: "subject:arsenal:0.5",
      label: "Arsenal 0.5",
      point: 0.5,
      selections: [
        {
          selection: "Arsenal · Over · 0.5",
          point: 0.5,
          odds: 1.72,
          bestOdds: 1.72,
          fairOdds: 1.52,
          bookmaker: "Book A",
          bookmakerKey: "book-a",
          consensusProbability: 0.66,
          marketProbability: 1 / 1.72,
          edge: 0.66 - 1 / 1.72,
          ev: 1.72 * 0.66 - 1,
          confidence: 0.86,
          bookmakerCount: 8,
          probabilityDispersion: 0.008,
          freshnessLabel: "fresh",
          latestUpdate: "2026-08-20T19:59:00.000Z",
          decision: "PLAY",
          analysisEligible: true
        },
        { selection: "Arsenal · Under · 1.0", point: 1, odds: 2.5, decision: "PRICE_ONLY", analysisEligible: false }
      ]
    }]
  }]
};

let calls = 0;
const scan = await scanAutonomousMarketUniverse({
  picks: [seed, { ...seed, gameId: "evt-2", id: "evt-2-home" }],
  origin: "https://scorecaster.vercel.app",
  now: clock,
  force: true,
  quotaReserve: 100,
  marketLoader: async ({ eventId }) => {
    calls += 1;
    return {
      ok: true,
      payload: { ...mockUniverse, event: { ...mockUniverse.event, id: eventId } },
      requestsRemaining: calls === 1 ? 100 : 99,
      requestsUsed: 10
    };
  }
});
assert.equal(calls, 1, "scanner must stop when quota reaches reserve");
assert.equal(scan.diagnostics.stoppedForQuotaReserve, true);
assert.equal(scan.diagnostics.priceOnlySkipped, 1);
assert.equal(scan.diagnostics.candidates, 1);
assert.equal(scan.candidates[0].marketKey, "team_totals");
assert.equal(scan.diagnostics.probabilityChangedByScanner, false);

const failedScan = await scanAutonomousMarketUniverse({
  picks: [seed],
  origin: "https://scorecaster.vercel.app",
  now: clock,
  force: true,
  marketLoader: async () => ({ ok: false, status: 429, payload: null, requestsRemaining: 0 })
});
assert.equal(failedScan.candidates.length, 0);
assert.equal(failedScan.diagnostics.providerFailures, 1);
assert.deepEqual(mergeAutonomousMarketCandidates([seed], failedScan.candidates), [seed]);

const merged = mergeAutonomousMarketCandidates([seed], [teamGoal, teamGoal]);
assert.equal(merged.length, 2);

const portfolio = buildAgentV9Portfolio(merged, {
  bankroll: 1000,
  maxStakePercent: 1,
  maxTotalExposurePercent: 5,
  maxLeagueExposurePercent: 2.5,
  riskProfile: "balanced"
});
const sameEvent = portfolio.decisions.filter((item) => item.gameId === "evt-1");
assert.equal(sameEvent.filter((item) => item.decision === "PLAY").length <= 1, true, "one-play-per-event must remain enforced");
assert.equal(portfolio.decisions.find((item) => item.marketKey === "team_totals")?.stressTest?.probability, 0.66);
assert.equal(portfolio.riskPolicy.probabilityAdjustedByRisk, false);

console.log("Autonomous Market Scanner V1 regression passed.");
