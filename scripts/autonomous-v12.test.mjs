import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAutonomousV12LearningReport,
  buildAutonomousV12Policy,
  evaluateAutonomousV12CircuitBreakers,
  nextAutonomousV12Check,
  selectAutonomousV12Picks
} from "../lib/autonomous-scorecaster-v12.mjs";

function settledRows(count = 220) {
  return Array.from({ length: count }, (_, index) => {
    const won = index % 2 === 0;
    return {
      id: `row-${index}`,
      status: won ? "won" : "lost",
      stake: 10,
      odds: won ? 2.08 : 1.95,
      closing_odds: won ? 2.02 : 1.92,
      created_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
      raw_pick: { modelProbability: won ? 0.54 : 0.49 }
    };
  });
}

function calibrationRows(count = 220) {
  return Array.from({ length: count }, (_, index) => ({
    model_probability: index % 2 === 0 ? 0.54 : 0.49,
    outcome: index % 2 === 0 ? 1 : 0
  }));
}

function playPick(overrides = {}) {
  return {
    eventId: "event-1",
    match: "Home vs Away",
    selection: "Home",
    productDecision: "PLAY",
    decision: "PLAY",
    odds: 2.05,
    edge: 0.045,
    ev: 0.055,
    confidence: 0.68,
    priorityScore: 0.78,
    robustnessScore: 0.72,
    bookmakerCount: 6,
    fixtureVerifiedByProvider: true,
    unifiedSportsData: { coverage: { verifiedCoverageRate: 0.7, independentOddsProviders: 2 } },
    stressTest: { probability: 0.54 },
    league: "NHL",
    sportKey: "icehockey_nhl",
    suggestedStake: 20,
    ...overrides
  };
}

test("learning report measures ROI, CLV, Brier, calibration and keeps promotion shadow-only", () => {
  const report = buildAutonomousV12LearningReport({
    history: settledRows(),
    calibration: calibrationRows(),
    now: new Date("2026-07-23T12:00:00.000Z")
  });
  assert.equal(report.performance.sampleSize, 220);
  assert.ok(Number.isFinite(report.performance.roi));
  assert.ok(Number.isFinite(report.performance.averageClv));
  assert.ok(Number.isFinite(report.performance.brier));
  assert.equal(report.calibration.sampleSize, 220);
  assert.equal(report.champion.probabilitySource, "no-vig market consensus");
  assert.equal(report.champion.productionProbabilityChanged, false);
  assert.equal(report.challenger.mode, "shadow-only");
  assert.equal(report.challenger.automaticProductionPromotion, false);
});

test("critical data and risk conditions pause autonomy", () => {
  const learning = buildAutonomousV12LearningReport({ history: [], calibration: [] });
  const circuit = evaluateAutonomousV12CircuitBreakers({
    learning,
    system: {
      killSwitch: false,
      paperTradingMode: true,
      oddsProviderConfigured: true,
      topPicksAvailable: true,
      providerScore: 20,
      staleRate: 0.75,
      captureAgeMinutes: 180,
      settlementBacklog: 120
    },
    bankroll: { bankroll: 1000 },
    todayRows: [],
    openBets: []
  });
  assert.equal(circuit.paused, true);
  assert.equal(circuit.state, "PAUSED");
  assert.ok(circuit.reasons.includes("provider_health_critical"));
  assert.ok(circuit.reasons.includes("market_data_stale"));
  assert.ok(circuit.reasons.includes("settlement_backlog_critical"));
});

test("policy only tightens risk and never upgrades decisions", () => {
  const policy = buildAutonomousV12Policy({
    settings: { daily_pick_limit: 3, min_priority_score: 0.62, min_odds: 1.2, max_odds: 5 },
    bankroll: { max_stake_percent: 2, max_daily_exposure_percent: 8, max_single_league_exposure_percent: 4, min_edge: 0.025, min_confidence: 0.58 },
    learning: { status: "watch", performance: { sampleSize: 80, clvSample: 50, averageClv: -0.01 } },
    circuit: { state: "CAUTION", paused: false }
  });
  assert.ok(policy.maxStakePercent < 2);
  assert.ok(policy.maxTotalExposurePercent < 8);
  assert.ok(policy.maxPicks <= 2);
  assert.ok(policy.minPriorityScore > 0.62);
  assert.equal(policy.automaticRelaxationAllowed, false);
  assert.equal(policy.canUpgradeDecision, false);
  assert.equal(policy.paperOnly, true);
});

test("selection requires verified PLAY evidence, enforces event uniqueness and stake caps", () => {
  const policy = {
    state: "RUNNING",
    maxPicks: 2,
    minPriorityScore: 0.65,
    minOdds: 1.2,
    maxOdds: 5,
    minEdge: 0.025,
    minConfidence: 0.58,
    minBookmakers: 4,
    minVerifiedCoverage: 0.35,
    maxStakePercent: 1,
    maxTotalExposurePercent: 5,
    maxLeagueExposurePercent: 3,
    kellyFraction: 0.25,
    riskScale: 1,
    version: "test-policy"
  };
  const result = selectAutonomousV12Picks({
    picks: [
      playPick(),
      playPick({ eventId: "event-1", selection: "Away", odds: 2.2 }),
      playPick({ eventId: "event-2", selection: "Away", bookmakerCount: 1, unifiedSportsData: { coverage: { verifiedCoverageRate: 0.1, independentOddsProviders: 1 } } }),
      playPick({ eventId: "event-3", selection: "Draw", productDecision: "CAUTION", decision: "WATCH" })
    ],
    policy,
    bankroll: { bankroll: 1000 },
    openBets: [],
    todayRows: []
  });
  assert.equal(result.selected.length, 1);
  assert.ok(result.selected[0].autonomousStake <= 10);
  assert.ok(result.skipped.some((row) => row.reasons.includes("event_already_used")));
  assert.ok(result.skipped.some((row) => row.reasons.includes("bookmaker_coverage_low")));
  assert.ok(result.skipped.some((row) => row.reasons.includes("not_play")));
});

test("paused policy produces no paper selections and next check is bounded", () => {
  const result = selectAutonomousV12Picks({
    picks: [playPick()],
    policy: { state: "PAUSED", maxPicks: 0, riskScale: 0 },
    bankroll: { bankroll: 1000 }
  });
  assert.equal(result.selected.length, 0);
  assert.equal(result.skipped[0].reasons[0], "circuit_breaker_paused");
  const next = nextAutonomousV12Check({ result: { savedCount: 0 }, circuit: { paused: true, reasons: ["market_data_stale"] }, learning: { status: "watch" }, now: new Date("2026-07-23T10:00:00.000Z") });
  assert.equal(next, "2026-07-23T11:00:00.000Z");
});

test("V12 ships protected storage, worker, web, mobile and release gates", async () => {
  const root = new URL("../", import.meta.url);
  const source = (path) => readFile(new URL(path, root), "utf8");
  const [sql, engine, worker, route, api, web, mobile, more, workflow, manifest] = await Promise.all([
    source("supabase/scorecaster_autonomous_v12.sql"),
    source("lib/autonomous-scorecaster-v12.mjs"),
    source("lib/autonomous-scorecaster-v12-worker.js"),
    source("app/api/internal/autonomous-v12/route.js"),
    source("app/api/cloud/autonomous-agent/route.js"),
    source("app/autonomous-agent/AutonomousV12Panel.jsx"),
    source("mobile/src/screens/AutonomousV12Screen.tsx"),
    source("mobile/src/screens/MoreScreen.tsx"),
    source(".github/workflows/notification-delivery.yml"),
    source("config/release-readiness.json")
  ]);
  assert.match(sql, /autonomous_agent_v12_controls/);
  assert.match(sql, /autonomous_agent_v12_learning_cycles/);
  assert.match(sql, /force row level security/);
  assert.match(engine, /automaticRelaxationAllowed: false/);
  assert.match(engine, /canUpgradeDecision: false/);
  assert.match(worker, /scorecaster-autonomous-v12/);
  assert.match(worker, /paperOnly: true/);
  assert.match(route, /autonomousAgentAuthorizationValid/);
  assert.match(api, /v12Available/);
  assert.match(web, /Champion \/ Challenger/);
  assert.match(web, /Circuit breakers/);
  assert.match(mobile, /AUTONOMOUS SCORECASTER V12/);
  assert.match(more, /AutonomousV12Screen/);
  assert.match(workflow, /\/api\/internal\/autonomous-v12/);
  assert.match(manifest, /scorecaster_autonomous_v12\.sql/);
  assert.match(manifest, /\/api\/internal\/autonomous-v12/);
  assert.doesNotMatch(worker, /bookmaker.*login|realMoneyBetting:\s*true/i);
});
