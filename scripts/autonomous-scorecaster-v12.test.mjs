import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyAutonomyPolicy,
  buildAutonomyJournal,
  buildAutonomyState,
  summarizeAutonomousDataReadiness,
  summarizeAutonomousHistory
} from "../lib/autonomous-scorecaster-v12.mjs";

function ledger({ verified = 0.8, coverage = 0.9, providers = 2, action = "KEEP_CURRENT_DECISION", missing = 0 } = {}) {
  return {
    coverage: {
      verifiedCoverageRate: verified,
      coverageRate: coverage,
      independentOddsProviders: providers
    },
    safetyRecommendation: { action },
    missingData: Array.from({ length: missing }, (_, index) => ({ factor: `factor-${index}`, missing: "missing" }))
  };
}

function decision(overrides = {}) {
  return {
    eventId: "event-v12",
    match: "Home vs Away",
    selection: "Home",
    decision: "PLAY",
    suggestedStake: 20,
    allocatedStake: 20,
    unifiedSportsData: ledger(),
    ...overrides
  };
}

function pushHistory(count = 130) {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index),
    status: "push",
    createdAt: new Date(index * 1000).toISOString()
  }));
}

test("history computes ROI, CLV, drawdown and losing streak without treating null fields as zero evidence", () => {
  const rows = [
    { id: "1", status: "won", stake: 10, odds: 2, closingOdds: 1.9, profit: null, clv: null, createdAt: "2026-07-20T10:00:00Z" },
    { id: "2", status: "lost", stake: 10, odds: 2, closingOdds: 2.1, profit: null, clv: null, createdAt: "2026-07-20T11:00:00Z" },
    { id: "3", status: "lost", stake: 10, odds: 2, closingOdds: null, profit: null, clv: null, createdAt: "2026-07-20T12:00:00Z" }
  ];
  const summary = summarizeAutonomousHistory(rows, { bankroll: 1000 });
  assert.equal(summary.settledCount, 3);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 2);
  assert.equal(summary.currentLosingStreak, 2);
  assert.equal(summary.longestLosingStreak, 2);
  assert.equal(summary.profit, -10);
  assert.equal(summary.roi, -0.3333);
  assert.equal(summary.maxDrawdown, 20);
  assert.equal(summary.clv.count, 2);
});

test("critical model drift freezes all new autonomous exposure", () => {
  const state = buildAutonomyState({
    history: pushHistory(130),
    decisions: [decision()],
    modelLab: { status: "promotion-ready", sampleSize: 130, drift: { status: "critical" }, promotion: { eligible: true } },
    bankroll: { bankroll: 1000, paperTradingMode: true }
  });
  assert.equal(state.mode, "FROZEN");
  assert.equal(state.stakeMultiplier, 0);
  assert.ok(state.blockers.includes("critical_model_drift"));
  const governed = applyAutonomyPolicy([decision()], state);
  assert.equal(governed[0].decision, "WATCH");
  assert.equal(governed[0].allocatedStake, 0);
  assert.equal(governed[0].autonomyV12.blocked, true);
});

test("rolling losses freeze for 24 hours and then recover into guarded mode", () => {
  const recentNow = new Date("2026-07-23T12:00:00Z");
  const lossRows = Array.from({ length: 6 }, (_, index) => ({
    id: `loss-${index}`,
    status: "lost",
    stake: 10,
    odds: 2,
    createdAt: new Date(recentNow.getTime() - (5 - index) * 3_600_000).toISOString()
  }));
  const recent = buildAutonomyState({
    history: [...pushHistory(124), ...lossRows],
    modelLab: { status: "promotion-ready", sampleSize: 130, drift: { status: "stable" }, promotion: { eligible: true } },
    bankroll: { bankroll: 1000, paperTradingMode: true },
    now: recentNow
  });
  assert.equal(recent.mode, "FROZEN");
  assert.ok(recent.blockers.includes("rolling_loss_limit"));
  assert.ok(recent.blockers.includes("loss_streak_cooldown"));

  const oldLossRows = lossRows.map((row) => ({ ...row, createdAt: new Date(Date.parse(row.createdAt) - 48 * 3_600_000).toISOString() }));
  const recovered = buildAutonomyState({
    history: [...pushHistory(124), ...oldLossRows],
    modelLab: { status: "promotion-ready", sampleSize: 130, drift: { status: "stable" }, promotion: { eligible: true } },
    bankroll: { bankroll: 1000, paperTradingMode: true },
    now: recentNow
  });
  assert.notEqual(recovered.mode, "FROZEN");
  assert.ok(recovered.warnings.includes("rolling_loss_recovery"));
});

test("insufficient sample stays bootstrap with minimum exposure and one-pick cap", () => {
  const state = buildAutonomyState({
    history: pushHistory(12),
    decisions: [decision(), decision({ eventId: "event-v12-2" })],
    modelLab: { status: "insufficient-data", sampleSize: 12, drift: { status: "insufficient" }, promotion: { eligible: false } },
    bankroll: { bankroll: 1000, paperTradingMode: true }
  });
  assert.equal(state.mode, "BOOTSTRAP");
  assert.equal(state.pickCap, 1);
  assert.equal(state.stakeMultiplier, 0.25);
  const governed = applyAutonomyPolicy([
    decision(),
    decision({ eventId: "event-v12-2", selection: "Away" })
  ], state);
  assert.equal(governed[0].decision, "PLAY");
  assert.ok(governed[0].allocatedStake > 0 && governed[0].allocatedStake < 10);
  assert.equal(governed[1].decision, "WATCH");
  assert.equal(governed[1].allocatedStake, 0);
  assert.ok(governed[1].autonomyV12.blockers.includes("autonomy:mode_pick_cap"));
});

test("healthy holdout and data readiness allow active paper autonomy", () => {
  const state = buildAutonomyState({
    history: pushHistory(130),
    decisions: [decision(), decision({ eventId: "event-v12-2", unifiedSportsData: ledger({ verified: 0.9 }) })],
    modelLab: { status: "promotion-ready", sampleSize: 130, drift: { status: "stable" }, promotion: { eligible: true }, challenger: { id: "shrink-0.1" } },
    bankroll: { bankroll: 1000, paperTradingMode: true }
  });
  assert.equal(state.mode, "ACTIVE");
  assert.equal(state.pickCap, 3);
  assert.equal(state.stakeMultiplier, 1);
  assert.equal(state.modelLab.probabilityApplied, false);
  assert.equal(state.realMoneyBetting, false);
});

test("low verified coverage and adverse context fail closed", () => {
  const state = {
    mode: "ACTIVE",
    blockers: [],
    warnings: [],
    stakeMultiplier: 1,
    pickCap: 3,
    requireMultiProvider: false
  };
  const lowCoverage = applyAutonomyPolicy([decision({ unifiedSportsData: ledger({ verified: 0.2 }) })], state)[0];
  assert.equal(lowCoverage.decision, "WATCH");
  assert.ok(lowCoverage.autonomyV12.blockers.includes("autonomy:verified_coverage_below_40pct"));

  const adverse = applyAutonomyPolicy([decision({ unifiedSportsData: ledger({ action: "DOWNGRADE_TO_CAUTION" }) })], state)[0];
  assert.equal(adverse.decision, "WATCH");
  assert.ok(adverse.autonomyV12.blockers.includes("autonomy:verified_context_downgrade"));
  assert.equal(adverse.autonomyV12.probabilityChanged, false);
});

test("data readiness and journal remain descriptive and paper-only", () => {
  const readiness = summarizeAutonomousDataReadiness([
    decision(),
    decision({ eventId: "event-v12-2", unifiedSportsData: ledger({ providers: 1, verified: 0.5, missing: 3 }) })
  ]);
  assert.equal(readiness.candidateCount, 2);
  assert.equal(readiness.multiProviderRate, 0.5);
  const state = buildAutonomyState({ decisions: [decision()], modelLab: { status: "insufficient-data", sampleSize: 0, drift: { status: "insufficient" } }, bankroll: { bankroll: 1000, paperTradingMode: true } });
  const journal = buildAutonomyJournal({ state, decisions: [decision()] });
  assert.equal(journal.probabilityChanged, false);
  assert.equal(journal.realMoneyBetting, false);
  assert.equal(journal.paperOnly, true);
});

test("V12 is wired into worker, leased preflight, web, cloud API and native mobile", async () => {
  const root = new URL("../", import.meta.url);
  const source = (path) => readFile(new URL(path, root), "utf8");
  const [worker, runner, governance, api, page, client, mobile, more, packageJson, manifest] = await Promise.all([
    source("app/api/internal/autonomous-agent/route.js"),
    source("lib/autonomous-scorecaster-v12-runner.js"),
    source("lib/agent-model-governance.mjs"),
    source("app/api/cloud/autonomy-mission-control/route.js"),
    source("app/mission-control/page.jsx"),
    source("app/mission-control/MissionControlClient.jsx"),
    source("mobile/src/screens/MissionControlScreen.tsx"),
    source("mobile/src/screens/MoreScreen.tsx"),
    source("package.json"),
    source("config/release-readiness.json")
  ]);
  assert.match(worker, /runAutonomousScorecasterV12/);
  assert.match(runner, /loss_streak_cooldown|rolling_loss_limit/);
  assert.match(runner, /v12_preflight/);
  assert.match(runner, /lease_expires_at\.is\.null,lease_expires_at\.lt/);
  assert.match(governance, /applyAutonomyPolicy/);
  assert.match(api, /autonomy-mission-control-v12/);
  assert.match(page, /MissionControlClient/);
  assert.match(client, /CIRCUIT BREAKERS/);
  assert.match(client, /CHAMPION \/ CHALLENGER/);
  assert.match(mobile, /AUTONOMOUS SCORECASTER V12/);
  assert.match(more, /MissionControlScreen/);
  assert.match(packageJson, /autonomous-scorecaster-v12\.test\.mjs/);
  assert.match(manifest, /\/mission-control/);
  assert.match(manifest, /\/api\/cloud\/autonomy-mission-control/);
  assert.match(manifest, /autonomous-v12-circuit-breakers/);
});
