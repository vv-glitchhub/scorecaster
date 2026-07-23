import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyAutonomousControl,
  buildAutonomousControlPlane,
  buildAutonomousIncidents,
  summarizeAutonomousPerformance,
  summarizeProviderReadiness
} from "../lib/autonomous-intelligence-v12.mjs";

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

test("rolling performance calculates ROI, CLV, Brier, drawdown and loss streak", () => {
  const report = summarizeAutonomousPerformance(settled(40), { bankroll: 1000 });
  assert.equal(report.sampleSize, 40);
  assert.equal(report.recent.settled, 20);
  assert.ok(report.recent.roi > 0);
  assert.ok(report.recent.averageClv > 0);
  assert.ok(report.recent.brierScore !== null);
  assert.ok(report.drawdownPercent >= 0);
});

test("critical drift activates kill switch and removes all new paper exposure", () => {
  const control = buildAutonomousControlPlane({
    history: settled(150),
    bankroll: 1000,
    modelLab: { ...stableModelLab(320), drift: { status: "critical" } },
    providerObservations: [{ ok: true, mode: "live", trust_score: 0.9, divergence: 0.01 }],
    settings: { autonomyProfile: "balanced" }
  });
  assert.equal(control.operatingMode, "frozen");
  assert.equal(control.killSwitch.active, true);
  assert.equal(control.riskPolicy.stakeMultiplier, 0);
  const governed = applyAutonomousControl([{ decision: "PLAY", suggestedStake: 20, allocatedStake: 20 }], control);
  assert.equal(governed[0].decision, "WATCH");
  assert.equal(governed[0].suggestedStake, 0);
  assert.equal(governed[0].autonomousV12.probabilityAdjustedByLearning, false);
});

test("insufficient history enters learning mode with one reduced paper pick", () => {
  const control = buildAutonomousControlPlane({
    history: settled(10),
    bankroll: 1000,
    modelLab: stableModelLab(10, false),
    providerObservations: [{ ok: true, mode: "live", trust_score: 0.88, divergence: 0.01 }],
    settings: { autonomyProfile: "conservative", dailyPickLimit: 3 }
  });
  assert.equal(control.operatingMode, "learning");
  assert.equal(control.riskPolicy.maximumPicks, 1);
  assert.ok(control.riskPolicy.stakeMultiplier > 0 && control.riskPolicy.stakeMultiplier < 0.5);
});

test("paper champion promotion needs two ready snapshots and never changes published probability", () => {
  const first = buildAutonomousControlPlane({
    history: settled(320),
    bankroll: 1000,
    modelLab: stableModelLab(),
    providerObservations: Array.from({ length: 20 }, () => ({ ok: true, mode: "live", trust_score: 0.9, divergence: 0.01 })),
    settings: { autonomyProfile: "balanced", autoPaperPromotion: true, learningEnabled: true },
    previousState: { promotion_ready_streak: 0, champion_model_key: "identity" }
  });
  assert.equal(first.modelLab.promotion.eligible, false);
  assert.ok(first.modelLab.promotion.reasons.includes("requires_two_consecutive_ready_snapshots"));

  const second = buildAutonomousControlPlane({
    history: settled(320),
    bankroll: 1000,
    modelLab: stableModelLab(),
    providerObservations: Array.from({ length: 20 }, () => ({ ok: true, mode: "live", trust_score: 0.9, divergence: 0.01 })),
    settings: { autonomyProfile: "balanced", autoPaperPromotion: true, learningEnabled: true },
    previousState: { promotion_ready_streak: 1, champion_model_key: "identity" }
  });
  assert.equal(second.modelLab.promotion.eligible, true);
  assert.equal(second.modelLab.promotion.action, "PROMOTE_PAPER_CHAMPION");
  assert.equal(second.modelLab.promotion.probabilityAppliedToPublishedModel, false);
  assert.equal(second.modelLab.promotion.affectsPaperRiskPolicyOnly, true);
});

test("provider outages and loss limits create explicit incidents", () => {
  const provider = summarizeProviderReadiness([{ ok: false, mode: "api_error", trust_score: 0.2 }], [{ active: true, severity: "high", incident_type: "provider_outage", title: "Outage" }]);
  assert.equal(provider.status, "offline");
  const badHistory = [...settled(30), ...Array.from({ length: 6 }, (_, index) => ({ id: `loss-${index}`, status: "lost", stake: 10, odds: 2, profit: -10, closingOdds: 2, modelProbability: 0.5, createdAt: new Date(Date.UTC(2026, 2, 1, index)).toISOString() }))];
  const control = buildAutonomousControlPlane({ history: badHistory, providerObservations: [{ ok: false }], providerIncidents: [{ active: true, severity: "high" }], settings: { maxConsecutiveLosses: 6 } });
  const incidents = buildAutonomousIncidents(control);
  assert.ok(incidents.some((item) => item.incidentType === "kill_switch"));
  assert.ok(incidents.some((item) => item.incidentType === "provider_offline"));
  assert.ok(incidents.some((item) => item.incidentType === "loss_streak"));
});

test("V12 ships storage, worker fallback, APIs, web and native cockpit", async () => {
  const [sql, worker, route, api, web, mobile, more, manifest] = await Promise.all([
    readFile(new URL("../supabase/scorecaster_autonomous_intelligence_v12.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/autonomous-paper-agent-v12.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/internal/autonomous-agent/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cloud/autonomous-agent/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/autonomous-agent/AutonomousAgentClient.jsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/screens/AutonomousIntelligenceScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/screens/MoreScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../config/release-readiness.json", import.meta.url), "utf8")
  ]);
  for (const token of ["autonomous_agent_models", "autonomous_agent_learning_snapshots", "autonomous_agent_incidents", "complete_autonomous_agent_user_v12", "force row level security"]) assert.match(sql, new RegExp(token));
  assert.match(worker, /runAutonomousPaperAgent/);
  assert.match(worker, /v12MigrationActive: false/);
  assert.match(worker, /buildAutonomousControlPlane/);
  assert.match(worker, /probabilityAdjustedByLearning: false/);
  assert.match(route, /runAutonomousIntelligenceV12/);
  assert.match(api, /minimumPromotionSamples: 300/);
  assert.match(web, /Autonomous Intelligence V12/);
  assert.match(web, /Kill switch/);
  assert.match(mobile, /AUTONOMOUS INTELLIGENCE V12/);
  assert.match(more, /AutonomousIntelligenceScreen/);
  assert.match(manifest, /scorecaster_autonomous_intelligence_v12\.sql/);
  assert.match(manifest, /autonomous-v12-model-governance/);
});
