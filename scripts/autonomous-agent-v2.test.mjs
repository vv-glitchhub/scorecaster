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
    eventId: "event-v2",
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

test("V2 settings normalize every governance limit without enabling real-money behavior", () => {
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

test("performance guard pauses after the configured loss streak and keeps learning shadow-only", () => {
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

test("performance guard stays conservative before the minimum sample", () => {
  const guard = buildPerformanceGuard({
    history: [
      settled("win", 10, 2, 1.9, "2026-07-21T10:00:00.000Z"),
      settled("win", 10, 2, 1.9, "2026-07-22T10:00:00.000Z")
    ],
    bankroll: 1000
  });
  assert.equal(guard.status, "watch");
  assert.equal(guard.stakeMultiplier, 0.5);
  assert.equal(guard.resolvedSample, 2);
});

test("system guard blocks active provider and all-SKIP incidents", () => {
  const guard = buildSystemGuard({
    decisionAlerts: [{ active: true, alert_type: "all_skip", severity: "high", title: "All SKIP" }],
    unifiedIncidents: [{ active: true, incident_type: "provider_outage", severity: "high", title: "Provider offline" }],
    settings: { autoPauseOnIncident: true }
  });
  assert.equal(guard.status, "blocked");
  assert.equal(guard.blockingIncidentCount, 2);
  assert.ok(guard.reasons.includes("active_system_incident"));
});

test("system guard watches optional and secondary-provider incidents while primary pricing is healthy", () => {
  const guard = buildSystemGuard({
    unifiedIncidents: [
      { active: true, incident_type: "provider_health", severity: "high", provider_key: "sports-context-provider", details: { family: "context" }, title: "Context offline" },
      { active: true, incident_type: "provider_health", severity: "high", provider_key: "sportsgameodds", details: { family: "odds" }, title: "Secondary pricing offline" },
      { active: true, incident_type: "provider_divergence", severity: "high", event_id: "event-1", title: "One event disagrees" }
    ],
    diagnostics: { provider_health: { status: "healthy", score: 93 } },
    settings: { autoPauseOnIncident: true }
  });
  assert.equal(guard.status, "watch");
  assert.equal(guard.blockingIncidentCount, 0);
  assert.equal(guard.watchedIncidentCount, 3);
  assert.equal(guard.primaryProviderStatus, "healthy");
  assert.deepEqual(guard.reasons, []);
});

test("system guard still blocks when current primary-provider diagnostics are down", () => {
  const guard = buildSystemGuard({
    decisionAlerts: [{ active: true, alert_type: "provider_health", severity: "high", title: "Primary pricing down" }],
    unifiedIncidents: [{ active: true, incident_type: "provider_health", severity: "high", provider_key: "the-odds-api", details: { family: "odds" }, title: "Primary provider offline" }],
    diagnostics: { provider_health: { status: "down", score: 0 } },
    settings: { autoPauseOnIncident: true }
  });
  assert.equal(guard.status, "blocked");
  assert.equal(guard.blockingIncidentCount, 2);
  assert.ok(guard.reasons.includes("active_system_incident"));
  assert.ok(guard.reasons.includes("provider_health_blocked"));
});

test("system guard fails closed for a high global odds incident when primary health is unknown", () => {
  const guard = buildSystemGuard({
    unifiedIncidents: [{ active: true, incident_type: "provider_health", severity: "high", provider_key: "unknown-odds", details: { family: "odds" }, title: "Pricing status unknown" }],
    settings: { autoPauseOnIncident: true }
  });
  assert.equal(guard.status, "blocked");
  assert.equal(guard.blockingIncidentCount, 1);
});

test("verified PLAY passes the V2 evidence, timing and user-risk gates", () => {
  const audit = evaluateAutonomousCandidate(verifiedDecision(), {
    settings: { minDataCoverage: 0.6, minProviderCount: 2, maxProviderDisagreement: 0.1, minOdds: 1.2, maxOdds: 5, minPriorityScore: 0.62 },
    bankroll: { minEdge: 0.025, minConfidence: 0.58 },
    performance: { status: "healthy" },
    system: { status: "healthy" },
    openEventIds: new Set(),
    now: Date.parse("2026-07-23T10:00:00.000Z")
  });
  assert.equal(audit.allowed, true);
  assert.deepEqual(audit.reasons, []);
  assert.equal(audit.policy.probabilityChanged, false);
  assert.equal(audit.policy.productionLearningApplied, false);
  assert.equal(audit.policy.canUpgradeToPlay, false);
  assert.equal(audit.policy.paperOnly, true);
});

test("candidate is blocked by missing unified data, provider disagreement and a safety downgrade", () => {
  const audit = evaluateAutonomousCandidate(verifiedDecision({
    unifiedDataSafetyDowngrade: true,
    unifiedSportsData: {
      paperOnly: true,
      coverage: { verifiedCoverageRate: 0.3, independentOddsProviders: 1 },
      safetyRecommendation: { action: "DOWNGRADE_TO_CAUTION" },
      factors: [{ key: "odds-consensus", evidence: [{ label: "providerDisagreement", value: 0.25 }] }]
    }
  }), {
    settings: { minDataCoverage: 0.6, minProviderCount: 2, maxProviderDisagreement: 0.1 },
    bankroll: { minEdge: 0.025, minConfidence: 0.58 },
    performance: { status: "healthy" },
    system: { status: "healthy" },
    openEventIds: new Set(),
    now: Date.parse("2026-07-23T10:00:00.000Z")
  });
  assert.equal(audit.allowed, false);
  assert.ok(audit.reasons.includes("unified_data_safety_downgrade"));
  assert.ok(audit.reasons.includes("data_coverage_below_minimum"));
  assert.ok(audit.reasons.includes("provider_count_below_minimum"));
  assert.ok(audit.reasons.includes("provider_disagreement_too_high"));
});

test("candidate is blocked when the event is already exposed or too close to start", () => {
  const decision = verifiedDecision({ commenceTime: "2026-07-23T10:10:00.000Z" });
  const audit = evaluateAutonomousCandidate(decision, {
    settings: { minimumMinutesBeforeStart: 20 },
    bankroll: { minEdge: 0.025, minConfidence: 0.58 },
    performance: { status: "healthy" },
    system: { status: "healthy" },
    openEventIds: new Set(["event-v2"]),
    now: Date.parse("2026-07-23T10:00:00.000Z")
  });
  assert.equal(audit.allowed, false);
  assert.ok(audit.reasons.includes("event_already_exposed"));
  assert.ok(audit.reasons.includes("event_too_close_or_started"));
});

test("adaptive cadence slows down after a safety pause and accelerates after a saved paper selection", () => {
  assert.equal(adaptiveNextCheckMinutes({ result: { savedCount: 1 }, settings: { adaptiveCadence: true }, system: { status: "healthy" }, performance: { status: "healthy" } }), 60);
  assert.equal(adaptiveNextCheckMinutes({ result: {}, settings: { adaptiveCadence: true, cooldownHours: 12 }, system: { status: "blocked" }, performance: { status: "healthy" } }), 720);
  assert.equal(adaptiveNextCheckMinutes({ result: {}, settings: { adaptiveCadence: false }, system: { status: "healthy" }, performance: { status: "healthy" } }), 180);
});

test("daily brief explains saved and blocked candidates without claiming live-money action", () => {
  const brief = buildAutonomousDailyBrief({
    performance: { status: "healthy", score: 88, resolvedSample: 120, roi: 0.03, clv: { average: 0.015 } },
    system: { status: "healthy" },
    result: { candidateCount: 3, savedCount: 1, totalStake: 8 },
    audits: [{ allowed: true, reasons: [] }, { allowed: false, reasons: ["data_coverage_below_minimum"] }, { allowed: false, reasons: ["data_coverage_below_minimum"] }]
  });
  assert.equal(brief.cycle.saved, 1);
  assert.equal(brief.commonBlockReasons[0].reason, "data_coverage_below_minimum");
  assert.equal(brief.learning.mode, "shadow-only");
  assert.equal(brief.learning.productionProbabilityChanged, false);
  assert.equal(brief.paperOnly, true);
  assert.equal(brief.realMoneyBetting, false);
});

test("V13 layers V2 governance over V12 Mission Control and ships complete privacy coverage", async () => {
  const [migration, performanceMigration, worker, dailyWorker, riskGovernor, runner, internal, cloud, web, page, mobile, more, accountExport, account, manifest] = await Promise.all([
    source("supabase/scorecaster_autonomous_agent_v2.sql"),
    source("supabase/scorecaster_autonomous_audit_performance_v1.sql"),
    source("lib/autonomous-paper-agent-governed-v13.js"),
    source("lib/autonomous-paper-agent-v2.js"),
    source("lib/autonomous-risk-governor.mjs"),
    source("lib/autonomous-scorecaster-v12-runner.js"),
    source("app/api/internal/autonomous-agent/route.js"),
    source("app/api/cloud/autonomous-agent/route.js"),
    source("app/autonomous-agent/AutonomousAgentClient.jsx"),
    source("app/autonomous-agent/page.jsx"),
    source("mobile/src/screens/AutonomousAgentScreen.tsx"),
    source("mobile/src/screens/MoreScreen.tsx"),
    source("app/api/account/export/route.js"),
    source("app/api/account/route.js"),
    source("config/release-readiness.json")
  ]);
  assert.match(migration, /autonomous_agent_decision_audit/);
  assert.match(migration, /autonomous_agent_daily_briefs/);
  assert.match(migration, /paused_until/);
  assert.match(migration, /complete_autonomous_agent_user_v2/);
  assert.match(migration, /status in \('running', 'success', 'error', 'deferred', 'paused'\)/);
  assert.match(migration, /force row level security/);
  assert.match(worker, /runAutonomousPaperAgentV2/);
  assert.match(worker, /MAX_USERS_PER_RUN = 2/);
  assert.match(worker, /MAX_SOURCE_GROUPS_PER_RUN = 2/);
  assert.match(worker, /MAX_INLINE_MARKET_SCAN_EVENTS = 1/);
  assert.match(worker, /maxEventsPerScan: MAX_INLINE_MARKET_SCAN_EVENTS/);
  assert.match(worker, /buildPerformanceGuard/);
  assert.match(worker, /buildSystemGuard/);
  assert.match(worker, /event_id,provider_key,details/);
  assert.match(worker, /evaluateAutonomousCandidate/);
  assert.match(worker, /commence_time: pickCommenceTime\(decision\)/);
  assert.match(worker, /scorecaster-autonomous-v2/);
  assert.match(worker, /productionProbabilityChangedByLearning: false/);
  assert.match(worker, /realMoneyBetting: false/);
  assert.match(dailyWorker, /buildAutonomousRiskGovernor/);
  assert.match(dailyWorker, /applyAutonomousSystemCaps/);
  assert.match(riskGovernor, /HARD_MAX_STAKE_PERCENT/);
  assert.match(runner, /runGovernedAutonomousPaperAgentV13/);
  assert.match(runner, /PREFLIGHT_LIMIT = 4/);
  assert.match(runner, /RECENT_RUN_ENRICH_LIMIT = 4/);
  assert.match(runner, /limit\(RECENT_RUN_ENRICH_LIMIT\)/);
  assert.match(runner, /autonomous-scorecaster-v13/);
  assert.match(runner, /persistentUtcDailyPickLimit/);
  assert.match(runner, /v12_preflight/);
  assert.match(internal, /runAutonomousScorecasterV12/);
  assert.match(internal, /\[autonomous-agent\] cycle completed/);
  assert.match(internal, /durationMs: Date\.now\(\) - startedAt/);
  assert.match(cloud, /autonomous_agent_decision_audit/);
  assert.match(cloud, /safety_cooldown_active/);
  assert.match(web, /Hätäpysäytys/);
  assert.match(web, /Decision audit/);
  assert.match(web, /shadow-only/);
  assert.match(page, /Autonomous Scorecaster V13/);
  assert.match(page, /Mission Control/);
  assert.match(mobile, /AUTONOMOUS PAPER AGENT V2/);
  assert.match(mobile, /Emergency stop/);
  assert.match(more, /AutonomousAgentScreen/);
  assert.match(more, /MissionControlScreen/);
  assert.match(accountExport, /autonomousAgentDecisionAudit/);
  assert.match(accountExport, /autonomousAgentDailyBriefs/);
  assert.match(account, /autonomous_agent_decision_audit/);
  assert.match(account, /autonomous_agent_daily_briefs/);
  assert.match(manifest, /scorecaster_autonomous_agent_v2\.sql/);
  assert.match(manifest, /autonomous-agent-v13-governance/);
  assert.match(manifest, /autonomous-v12-circuit-breakers/);
  assert.match(performanceMigration, /market_provider_snapshots_v2 \(event_id, commence_time\)/);
});

test("V13 source contains no bookmaker credentials, payments or real-money execution path", async () => {
  const sourceText = [
    await source("lib/autonomous-agent-v2.mjs"),
    await source("lib/autonomous-paper-agent-governed-v13.js"),
    await source("lib/autonomous-paper-agent-v2.js"),
    await source("lib/autonomous-risk-governor.mjs"),
    await source("lib/autonomous-scorecaster-v12-runner.js"),
    await source("app/api/cloud/autonomous-agent/route.js")
  ].join("\n");
  assert.doesNotMatch(sourceText, /bookmaker.*password|payment.*card|bank.*credential|deposit.*endpoint|withdraw.*endpoint/i);
  assert.match(sourceText, /paperOnly/);
  assert.match(sourceText, /realMoneyBetting: false/);
  assert.match(sourceText, /productionProbabilityChanged/);
});
