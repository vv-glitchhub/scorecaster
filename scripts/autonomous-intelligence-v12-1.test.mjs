import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildV121Control,
  buildV121Incidents,
  summarizeV121Performance,
  summarizeV121ProviderHealth
} from "../lib/autonomous-intelligence-v12-1.mjs";

function settled(count, { lossEvery = 4, clv = 0.02, stake = 10 } = {}) {
  return Array.from({ length: count }, (_, index) => {
    const loss = index % lossEvery === 0;
    return {
      id: `sample-${index}`,
      status: loss ? "lost" : "won",
      stake,
      odds: 1.9,
      closingOdds: 1.9 / (1 + clv),
      profit: loss ? -stake : stake * 0.9,
      modelProbability: 0.55,
      createdAt: new Date(Date.UTC(2026, 0, 1, index)).toISOString()
    };
  });
}

function stableModelLab(sampleSize = 320, eligible = true) {
  return {
    version: "V11-model-lab",
    status: eligible ? "promotion-ready" : "challenger-rejected",
    sampleSize,
    drift: { status: "stable" },
    promotion: { eligible },
    challenger: {
      id: "temperature-1.15",
      candidate: { type: "temperature", temperature: 1.15 },
      train: { brierScore: 0.21 },
      holdout: { brierScore: 0.2, logLoss: 0.58, calibrationGap: 0.01 }
    }
  };
}

test("V12.1 performance calculates ROI, CLV, Brier, drawdown and loss streak", () => {
  const report = summarizeV121Performance(settled(40), { bankroll: 1000 });
  assert.equal(report.sampleSize, 40);
  assert.equal(report.recent.count, 20);
  assert.ok(report.recent.roi > 0);
  assert.ok(report.recent.averageClv > 0);
  assert.ok(report.recent.brierScore !== null);
  assert.ok(report.drawdownRate >= 0);
});

test("provider health reacts to outages, trust and divergence", () => {
  const healthy = summarizeV121ProviderHealth(Array.from({ length: 20 }, () => ({ ok: true, mode: "live", trust_score: 0.9, divergence: 0.01 })), []);
  assert.equal(healthy.status, "healthy");
  const offline = summarizeV121ProviderHealth([{ ok: false, mode: "api_error", trust_score: 0.2, divergence: 0.2 }], [{ active: true, severity: "high" }]);
  assert.equal(offline.status, "offline");
});

test("critical base blocker, provider outage, loss streak and drawdown keep exposure frozen", () => {
  const history = [...settled(30), ...Array.from({ length: 6 }, (_, index) => ({ id: `loss-${index}`, status: "lost", stake: 10, odds: 2, profit: -10, closingOdds: 2, modelProbability: 0.5, createdAt: new Date(Date.UTC(2026, 2, 1, index)).toISOString() }))];
  const control = buildV121Control({
    baseState: { mode: "FROZEN", blockers: ["critical_model_drift"], warnings: [] },
    history,
    bankroll: 1000,
    modelLab: { ...stableModelLab(320), drift: { status: "critical" } },
    providerObservations: [{ ok: false, mode: "api_error" }],
    providerIncidents: [{ active: true, severity: "high" }],
    settings: { maxConsecutiveLosses: 6, maxDrawdownPercent: 12 }
  });
  assert.equal(control.mode, "FROZEN");
  assert.equal(control.killSwitchActive, true);
  assert.ok(control.blockers.includes("critical_model_drift"));
  assert.ok(control.blockers.includes("provider_outage_or_high_incident"));
  assert.ok(control.blockers.includes("configured_loss_streak_limit"));
  const incidents = buildV121Incidents(control);
  assert.ok(incidents.some((item) => item.incidentType === "kill_switch"));
  assert.ok(incidents.some((item) => item.incidentType === "provider_offline"));
});

test("previous kill switch clears through recovery rather than immediate active mode", () => {
  const control = buildV121Control({
    baseState: { mode: "ACTIVE", blockers: [], warnings: [] },
    history: settled(80),
    bankroll: 1000,
    modelLab: stableModelLab(80, false),
    providerObservations: Array.from({ length: 20 }, () => ({ ok: true, mode: "live", trust_score: 0.9, divergence: 0.01 })),
    previousState: { kill_switch_active: true },
    settings: {}
  });
  assert.equal(control.mode, "RECOVERY");
  assert.equal(control.nextIntervalMinutes, 90);
});

test("paper model promotion needs 300 samples, two ready snapshots and never changes published probability", () => {
  const common = {
    baseState: { mode: "ACTIVE", blockers: [], warnings: [] },
    history: settled(320),
    bankroll: 1000,
    modelLab: stableModelLab(),
    providerObservations: Array.from({ length: 20 }, () => ({ ok: true, mode: "live", trust_score: 0.9, divergence: 0.01 })),
    settings: { learningEnabled: true, autoPaperPromotion: true }
  };
  const first = buildV121Control({ ...common, previousState: { promotion_ready_streak: 0, champion_model_key: "identity" } });
  assert.equal(first.modelLab.promotion.eligible, false);
  assert.ok(first.modelLab.promotion.reasons.includes("requires_two_ready_snapshots"));
  const second = buildV121Control({ ...common, previousState: { promotion_ready_streak: 1, champion_model_key: "identity" } });
  assert.equal(second.modelLab.promotion.eligible, true);
  assert.equal(second.modelLab.promotion.action, "PROMOTE_PAPER_CHAMPION");
  assert.equal(second.modelLab.promotion.probabilityAppliedToPublishedModel, false);
  assert.equal(second.modelLab.promotion.paperRiskPolicyOnly, true);
  assert.equal(second.publishedProbabilityChanged, false);
});

test("V12.1 wraps the reviewed Daily Governor and ships persistence, APIs, UI, alerts and lifecycle handling", async () => {
  const root = new URL("../", import.meta.url);
  const read = (path) => readFile(new URL(path, root), "utf8");
  const [sql, runner, route, cloud, mission, panel, alerts, exportRoute, accountRoute, manifest, verifier] = await Promise.all([
    read("supabase/scorecaster_autonomous_intelligence_v12.sql"),
    read("lib/autonomous-intelligence-v12-1-runner.js"),
    read("app/api/internal/autonomous-agent/route.js"),
    read("app/api/cloud/autonomous-agent/route.js"),
    read("app/api/cloud/autonomy-mission-control/route.js"),
    read("app/autonomous-agent/AutonomousV121Panel.jsx"),
    read("app/alerts/AutonomousIncidentPanel.jsx"),
    read("app/api/account/export/route.js"),
    read("app/api/account/route.js"),
    read("config/release-readiness.json"),
    read("scripts/verify-autonomous-v12-schema.sql")
  ]);
  for (const token of ["autonomous_agent_models", "autonomous_agent_learning_snapshots", "autonomous_agent_incidents", "force row level security", "probability_applied_to_published_model"]) assert.match(sql, new RegExp(token));
  assert.match(runner, /runAutonomousScorecasterV12/);
  assert.match(runner, /existingDailyGovernorPreserved: true/);
  assert.match(runner, /autonomous-intelligence-v12\.1-fallback-v12/);
  assert.match(route, /runAutonomousIntelligenceV121/);
  assert.match(cloud, /minimumPromotionSamples: 300/);
  assert.match(mission, /persistentControl/);
  assert.match(panel, /Autonomous Intelligence V12\.1/);
  assert.match(alerts, /Autonomous Intelligence V12\.1/);
  assert.match(exportRoute, /autonomousAgentLearningSnapshots/);
  assert.match(accountRoute, /"autonomous_agent_models"/);
  assert.match(manifest, /scorecaster_autonomous_intelligence_v12\.sql/);
  assert.match(verifier, /publishedProbabilityChangesDenied/);
});
