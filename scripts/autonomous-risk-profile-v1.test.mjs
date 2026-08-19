import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AGENT_RISK_HARD_CAPS,
  getEffectiveAgentRiskLimits,
  publicAgentRiskPolicy
} from "../lib/agent-risk-profile-v1.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("autonomous risk profiles reuse the shared Agent policy and never exceed paper hard caps", () => {
  const conservative = publicAgentRiskPolicy("conservative");
  const balanced = publicAgentRiskPolicy("balanced");
  const aggressive = publicAgentRiskPolicy("aggressive");

  assert.ok(conservative.minEdge > balanced.minEdge);
  assert.ok(balanced.minEdge > aggressive.minEdge);
  assert.ok(conservative.kellyFraction < balanced.kellyFraction);
  assert.ok(balanced.kellyFraction < aggressive.kellyFraction);
  for (const profile of ["conservative", "balanced", "aggressive"]) {
    const limits = getEffectiveAgentRiskLimits({
      riskProfile: profile,
      maxStakePercent: 5,
      maxTotalExposurePercent: 20,
      maxLeagueExposurePercent: 10
    });
    assert.ok(limits.maxStakePercent <= AGENT_RISK_HARD_CAPS.maxStakePercent);
    assert.ok(limits.maxTotalExposurePercent <= AGENT_RISK_HARD_CAPS.maxTotalExposurePercent);
    assert.ok(limits.maxLeagueExposurePercent <= AGENT_RISK_HARD_CAPS.maxLeagueExposurePercent);
  }
  assert.equal(aggressive.requireRobustPositive, true);
  assert.equal(aggressive.probabilityChanged, false);
  assert.equal(aggressive.edgeChanged, false);
  assert.equal(aggressive.evChanged, false);
  assert.equal(aggressive.paperOnly, true);
});

test("autonomous settings and audit schema persist a bounded risk profile without adding public tables", async () => {
  const migration = await read("supabase/scorecaster_autonomous_agent_risk_profile_v1.sql");
  assert.match(migration, /autonomous_agent_settings[\s\S]*risk_profile text not null default 'balanced'/);
  assert.match(migration, /risk_profile in \('conservative', 'balanced', 'aggressive'\)/);
  assert.match(migration, /autonomous_agent_decision_audit[\s\S]*risk_policy jsonb/);
  assert.match(migration, /update of[\s\S]*risk_profile[\s\S]*schedule_autonomous_agent_for_user/);
  assert.doesNotMatch(migration, /create table/i);
  assert.doesNotMatch(migration, /grant .*anon|grant .*authenticated/i);
});

test("authenticated autonomous risk endpoint is paper-only, origin-guarded and uses the shared policy", async () => {
  const route = await read("app/api/cloud/autonomous-agent/risk-profile/route.js");
  assert.match(route, /getAuthenticatedContext/);
  assert.match(route, /mutationOriginAllowed/);
  assert.match(route, /enforceRateLimit/);
  assert.match(route, /AGENT_RISK_PROFILES/);
  assert.match(route, /publicAgentRiskPolicy/);
  assert.match(route, /risk_profile/);
  assert.match(route, /realMoneyBetting: false/);
  assert.match(route, /probabilityChangedByRisk: false/);
  assert.match(route, /edgeChangedByRisk: false/);
  assert.match(route, /evChangedByRisk: false/);
});

test("autonomous worker carries the selected profile through portfolio, effective limits, audit and paper pick", async () => {
  const worker = await read("lib/autonomous-paper-agent-governed-v13.js");
  assert.match(worker, /normalizeAgentRiskProfile/);
  assert.match(worker, /riskProfile: normalizeAgentRiskProfile\(row\.risk_profile\)/);
  assert.match(worker, /shadow_learning_enabled,risk_profile/);
  assert.match(worker, /riskProfile: entry\.context\.settings\.riskProfile/);
  assert.match(worker, /portfolio\.effectiveLimits\.maxStakePercent/);
  assert.match(worker, /portfolio\.effectiveLimits\.maxTotalExposurePercent/);
  assert.match(worker, /portfolio\.effectiveLimits\.maxLeagueExposurePercent/);
  assert.match(worker, /allocatedStake \?\? decision\.suggestedStake/);
  assert.doesNotMatch(worker, /allocatedStake \|\| decision\.suggestedStake/);
  assert.match(worker, /risk_profile: decision\.riskProfile/);
  assert.match(worker, /risk_policy: decision\.riskPolicy/);
  assert.match(worker, /probabilityChangedByRisk: false/);
});

test("autonomous UI exposes the three risk levels and preserves personal floors", async () => {
  const [page, card, mobile] = await Promise.all([
    read("app/autonomous-agent/page.jsx"),
    read("app/autonomous-agent/AutonomousRiskProfileCard.jsx"),
    read("mobile/src/screens/AutonomousAgentScreen.tsx")
  ]);
  assert.match(page, /AutonomousRiskProfileCard/);
  assert.match(card, /Autonomous Risk Control V1/);
  assert.match(card, /conservative/);
  assert.match(card, /balanced/);
  assert.match(card, /aggressive/);
  assert.match(card, /Varovainen/);
  assert.match(card, /Tasapainoinen/);
  assert.match(card, /Rohkea/);
  assert.match(card, /personal min edge \/ min confidence remain additional safety floors/i);
  assert.match(card, /1% single-pick, 5% total or 2\.5% league exposure/);
  assert.match(card, /cannot place real-money bets/);
  assert.match(mobile, /AUTONOMOUS RISK CONTROL V1/);
  assert.match(mobile, /saveRiskProfile/);
  assert.match(mobile, /1% \/ 5% \/ 2\.5%/);
});
