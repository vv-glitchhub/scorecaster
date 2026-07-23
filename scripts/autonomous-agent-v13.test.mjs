import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  adaptiveNextCheckMinutes,
  buildAutonomousDailyBrief,
  buildPerformanceGuard,
  buildSystemGuard,
  evaluateAutonomousCandidate,
  normalizeAutonomousV2Settings
} from "../lib/autonomous-agent-v2.mjs";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

function settled(result, stake = 10, odds = 2, closingOdds = 1.9, createdAt = "2026-07-22T10:00:00.000Z") {
  return { result, stake, odds, closingOdds, createdAt };
}

function verifiedDecision(overrides = {}) {
  return {
    eventId: "event-v13",
    match: "Home vs Away",
    selection: "Home",
    league: "NHL",
    sportKey: "icehockey_nhl",
    commenceTime: "2026-07-24T18:00:00.000Z",
    fixtureVerifiedByProvider: true,
    decision: "PLAY",
    productDecision: "PLAY",
    odds: 2.05,
    edge: 0.045,
    confidence: 0.7,
    priorityScore: 0.78,
    unifiedSportsData: {
      paperOnly: true,
      coverage: { verifiedCoverageRate: 0.8, independentOddsProviders: 2 },
      totalBoundedContextImpact: -0.005,
      safetyRecommendation: { action: "KEEP_CURRENT_DECISION" },
      factors: [{ key: "odds-consensus", evidence: [{ label: "providerDisagreement", value: 0.04 }] }]
    },
    ...overrides
  };
}

test("V13 settings clamp governance limits without enabling real-money behavior", () => {
  const settings = normalizeAutonomousV2Settings({
    min_data_coverage: 2,
    min_provider_count: 9,
    max_provider_disagreement: 0,
    max_drawdown_percent: 100,
    cooldown_hours: 999
  });
  assert.equal(settings.minDataCoverage, 1);
  assert.equal(settings.minProviderCount, 5);
  assert.equal(settings.maxProviderDisagreement, 0.01);
  assert.equal(settings.maxDrawdownPercent, 50);
  assert.equal(settings.cooldownHours, 168);
  assert.equal(settings.requireUnifiedData, true);
  assert.equal(settings.shadowLearningEnabled, true);
});

test("performance guard pauses after the configured loss streak and stays shadow-only", () => {
  const history = [
    settled("win", 10, 2, 2.1, "2026-07-20T10:00:00.000Z"),
    settled("loss", 10, 2, 1.9, "2026-07-21T10:00:00.000Z"),
    settled("loss", 10, 2, 1.9, "2026-07-21T12:00:00.000Z"),
    settled("loss", 10, 2, 1.9, "2026-07-21T14:00:00.000Z")
  ];
  const guard = buildPerformanceGuard({ history, bankroll: 1000, settings: { pauseAfterLosses: 3 }, now: Date.parse("2026-07-23T10:00:00.000Z") });
  assert.equal(guard.status, "paused");
  assert.ok(guard.reasons.includes("loss_streak_limit_reached"));
  assert.equal(guard.stakeMultiplier, 0);
  assert.equal(guard.shadowLearningOnly, true);
});

test("system guard blocks provider and all-SKIP incidents", () => {
  const guard = buildSystemGuard({
    decisionAlerts: [{ active: true, alert_type: "all_skip", severity: "high", title: "All SKIP" }],
    unifiedIncidents: [{ active: true, incident_type: "provider_outage", severity: "high", title: "Provider offline" }],
    settings: { autoPauseOnIncident: true }
  });
  assert.equal(guard.status, "blocked");
  assert.equal(guard.blockingIncidentCount, 2);
  assert.ok(guard.reasons.includes("active_system_incident"));
});

test("verified PLAY passes evidence, timing and user-risk gates", () => {
  const audit = evaluateAutonomousCandidate(verifiedDecision(), {
    settings: { minDataCoverage: 0.6, minProviderCount: 2, maxProviderDisagreement: 0.1, minOdds: 1.2, maxOdds: 5, minPriorityScore: 0.62 },
    bankroll: { minEdge: 0.025, minConfidence: 0.58 },
    performance: { status: "healthy" },
    system: { status: "healthy" },
    openEventIds: new Set(),
    now: Date.parse("2026-07-23T10:00:00.000Z")
  });
  assert.equal(audit.allowed, true);
  assert.equal(audit.policy.probabilityChanged, false);
  assert.equal(audit.policy.canUpgradeToPlay, false);
  assert.equal(audit.policy.paperOnly, true);
});

test("candidate fails closed on coverage, provider disagreement, timing and safety downgrade", () => {
  const audit = evaluateAutonomousCandidate(verifiedDecision({
    commenceTime: "2026-07-23T10:10:00.000Z",
    unifiedDataSafetyDowngrade: true,
    unifiedSportsData: {
      paperOnly: true,
      coverage: { verifiedCoverageRate: 0.3, independentOddsProviders: 1 },
      safetyRecommendation: { action: "DOWNGRADE_TO_CAUTION" },
      factors: [{ key: "odds-consensus", evidence: [{ label: "providerDisagreement", value: 0.25 }] }]
    }
  }), {
    settings: { minDataCoverage: 0.6, minProviderCount: 2, maxProviderDisagreement: 0.1, minimumMinutesBeforeStart: 20 },
    bankroll: { minEdge: 0.025, minConfidence: 0.58 },
    performance: { status: "healthy" },
    system: { status: "healthy" },
    openEventIds: new Set(["event-v13"]),
    now: Date.parse("2026-07-23T10:00:00.000Z")
  });
  for (const reason of [
    "unified_data_safety_downgrade",
    "data_coverage_below_minimum",
    "provider_count_below_minimum",
    "provider_disagreement_too_high",
    "event_already_exposed",
    "event_too_close_or_started"
  ]) assert.ok(audit.reasons.includes(reason));
});

test("adaptive cadence and daily brief remain bounded and paper-only", () => {
  assert.equal(adaptiveNextCheckMinutes({ result: { savedCount: 1 }, settings: { adaptiveCadence: true }, system: { status: "healthy" }, performance: { status: "healthy" } }), 60);
  assert.equal(adaptiveNextCheckMinutes({ result: {}, settings: { adaptiveCadence: true, cooldownHours: 12 }, system: { status: "blocked" }, performance: { status: "healthy" } }), 720);
  const brief = buildAutonomousDailyBrief({
    performance: { status: "healthy", score: 88, resolvedSample: 120, roi: 0.03, clv: { average: 0.015 } },
    system: { status: "healthy" },
    result: { candidateCount: 3, savedCount: 1, totalStake: 8 },
    audits: [{ allowed: true, reasons: [] }, { allowed: false, reasons: ["data_coverage_below_minimum"] }]
  });
  assert.equal(brief.learning.mode, "shadow-only");
  assert.equal(brief.learning.productionProbabilityChanged, false);
  assert.equal(brief.paperOnly, true);
  assert.equal(brief.realMoneyBetting, false);
});

test("V13 integrates with strict V12 daily governor, RLS audit and activation", async () => {
  const [migration, worker, riskGovernor, runner, internal, mission, release, verifier, packageJson] = await Promise.all([
    source("supabase/scorecaster_autonomous_agent_v2.sql"),
    source("lib/autonomous-paper-agent-v2.js"),
    source("lib/autonomous-risk-governor.mjs"),
    source("lib/autonomous-scorecaster-v12-runner.js"),
    source("app/api/internal/autonomous-agent/route.js"),
    source("app/api/cloud/autonomy-mission-control/route.js"),
    source("config/release-readiness.json"),
    source("scripts/verify-autonomous-v13-schema.sql"),
    source("package.json")
  ]);
  assert.match(migration, /autonomous_agent_decision_audit/);
  assert.match(migration, /autonomous_agent_daily_briefs/);
  assert.match(migration, /paused_until/);
  assert.match(migration, /complete_autonomous_agent_user_v2/);
  assert.match(migration, /force row level security/);
  assert.match(worker, /buildPerformanceGuard/);
  assert.match(worker, /buildSystemGuard/);
  assert.match(worker, /evaluateAutonomousCandidate/);
  assert.match(worker, /autonomous_agent_decision_audit/);
  assert.match(worker, /scorecaster-autonomous-v13/);
  assert.match(worker, /hardMaxStakePercent: 1/);
  assert.match(riskGovernor, /HARD_MAX_DAILY_EXPOSURE_PERCENT = 5/);
  assert.match(runner, /runAutonomousPaperAgentV2/);
  assert.match(internal, /runAutonomousScorecasterV12/);
  assert.match(mission, /autonomy-mission-control-v12-daily-governor/);
  assert.match(release, /scorecaster_autonomous_agent_v2\.sql/);
  assert.match(verifier, /databaseCooldownVerified/);
  assert.match(packageJson, /autonomous-agent-v13\.test\.mjs/);
});

test("V13 sources contain no real-money or payment execution path", async () => {
  const sourceText = [
    await source("lib/autonomous-agent-v2.mjs"),
    await source("lib/autonomous-paper-agent-v2.js"),
    await source("lib/autonomous-risk-governor.mjs"),
    await source("lib/autonomous-scorecaster-v12-runner.js")
  ].join("\n");
  assert.doesNotMatch(sourceText, /bookmaker.*password|payment.*card|bank.*credential|deposit.*endpoint|withdraw.*endpoint/i);
  assert.match(sourceText, /paperOnly/);
  assert.match(sourceText, /realMoneyBetting: false/);
  assert.match(sourceText, /productionProbabilityChanged/);
});
