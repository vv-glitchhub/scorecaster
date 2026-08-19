import test from "node:test";
import assert from "node:assert/strict";
import { calculateAgentPerformance } from "../lib/agent-learning.js";
import {
  buildAgentV9Decision,
  buildAgentV9Portfolio,
  buildProbabilityStressTest
} from "../lib/agent-v9-engine.mjs";
import {
  AGENT_RISK_HARD_CAPS,
  getEffectiveAgentRiskLimits,
  normalizeAgentRiskProfile
} from "../lib/agent-risk-profile-v1.mjs";

function strongPick(overrides = {}) {
  return {
    id: "event-1-home",
    gameId: "event-1",
    match: "Home FC vs Away FC",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    selection: "Home FC",
    sportKey: "soccer_epl",
    league: "soccer_epl",
    marketKey: "h2h",
    productDecision: "PLAY",
    consensusProbability: 0.58,
    odds: 2.05,
    marketProbability: 1 / 2.05,
    edge: 0.0922,
    ev: 0.189,
    confidence: 0.9,
    trustScore: 88,
    bookmakerCount: 8,
    probabilityDispersion: 0.008,
    freshnessLabel: "fresh",
    bookmaker: "Book A",
    ...overrides
  };
}

test("Agent V9 probability stress widens when data quality weakens", () => {
  const strong = buildProbabilityStressTest(strongPick());
  const weak = buildProbabilityStressTest(strongPick({
    confidence: 0.35,
    bookmakerCount: 2,
    probabilityDispersion: 0.07
  }));

  assert.ok(strong.halfWidth < weak.halfWidth);
  assert.ok(strong.lower < strong.probability);
  assert.ok(strong.upper > strong.probability);
  assert.ok(strong.breakEvenOdds > 1);
});

test("Agent V9 refuses PLAY when downside EV is not positive", () => {
  const decision = buildAgentV9Decision({
    pick: strongPick({
      consensusProbability: 0.52,
      odds: 2,
      edge: 0.02,
      ev: 0.04,
      confidence: 0.56,
      trustScore: 70,
      bookmakerCount: 4,
      probabilityDispersion: 0.035
    })
  });

  assert.equal(decision.decision, "WATCH");
  assert.equal(decision.suggestedStake, 0);
  assert.ok(decision.blockers.some((item) => item.includes("stressatun")));
  assert.equal(decision.probabilityAdjustedByLearning, false);
});

test("Agent V9 uses the uncertainty lower bound for stake sizing", () => {
  const decision = buildAgentV9Decision({
    pick: strongPick(),
    bankroll: 1000,
    maxStakePercent: 5
  });

  assert.equal(decision.decision, "PLAY");
  assert.ok(decision.suggestedStake > 0, JSON.stringify({
    suggestedStake: decision.suggestedStake,
    maxStakePercent: decision.maxStakePercent,
    bankroll: decision.bankroll,
    stressTest: decision.stressTest,
    riskProfile: decision.riskProfile,
    riskPolicy: decision.riskPolicy,
    blockers: decision.blockers
  }));
  assert.ok(decision.suggestedStake <= 10);
  assert.ok(decision.stressTest.robustPositive);
  assert.ok(decision.counterArguments.length >= 3);
  assert.ok(decision.priceGuard.minimumPlayOdds > decision.priceGuard.breakEvenOdds);
});

test("Agent risk profile can be selected without changing probability edge or EV", () => {
  const pick = strongPick({
    confidence: 0.53,
    trustScore: 60,
    edge: 0.018,
    ev: 0.025,
    odds: 2,
    bookmakerCount: 6
  });
  const balanced = buildAgentV9Decision({ pick, riskProfile: "balanced" });
  const aggressive = buildAgentV9Decision({ pick, riskProfile: "aggressive" });

  assert.equal(balanced.decision, "WATCH");
  assert.equal(aggressive.decision, "PLAY");
  assert.equal(aggressive.riskProfile, "aggressive");
  assert.equal(aggressive.consensusProbability, pick.consensusProbability);
  assert.equal(aggressive.edge, pick.edge);
  assert.equal(aggressive.ev, pick.ev);
  assert.equal(aggressive.probabilityAdjustedByRisk, false);
  assert.equal(aggressive.edgeAdjustedByRisk, false);
  assert.equal(aggressive.evAdjustedByRisk, false);
  assert.equal(aggressive.paperOnly, true);
});

test("conservative risk profile uses smaller virtual stake than balanced", () => {
  const conservative = buildAgentV9Decision({
    pick: strongPick(),
    bankroll: 1000,
    maxStakePercent: 1,
    riskProfile: "conservative"
  });
  const balanced = buildAgentV9Decision({
    pick: strongPick(),
    bankroll: 1000,
    maxStakePercent: 1,
    riskProfile: "balanced"
  });

  assert.equal(conservative.decision, "PLAY");
  assert.equal(balanced.decision, "PLAY");
  assert.ok(conservative.suggestedStake > 0);
  assert.ok(conservative.suggestedStake < balanced.suggestedStake);
  assert.ok(conservative.maxStakePercent <= 0.5);
});

test("aggressive risk profile cannot exceed production paper hard caps", () => {
  const limits = getEffectiveAgentRiskLimits({
    riskProfile: "aggressive",
    maxStakePercent: 5,
    maxTotalExposurePercent: 20,
    maxLeagueExposurePercent: 10
  });
  const portfolio = buildAgentV9Portfolio([
    strongPick({ id: "a", gameId: "a" }),
    strongPick({ id: "b", gameId: "b" }),
    strongPick({ id: "c", gameId: "c" })
  ], {
    bankroll: 1000,
    maxStakePercent: 5,
    maxTotalExposurePercent: 20,
    maxLeagueExposurePercent: 10,
    riskProfile: "aggressive"
  });

  assert.equal(limits.maxStakePercent, AGENT_RISK_HARD_CAPS.maxStakePercent);
  assert.equal(limits.maxTotalExposurePercent, AGENT_RISK_HARD_CAPS.maxTotalExposurePercent);
  assert.equal(limits.maxLeagueExposurePercent, AGENT_RISK_HARD_CAPS.maxLeagueExposurePercent);
  assert.ok(portfolio.totalCap <= 50);
  assert.ok(portfolio.leagueCap <= 25);
  assert.ok(portfolio.decisions.every((item) => Number(item.suggestedStake || 0) <= 10));
  assert.equal(portfolio.probabilityAdjustedByRisk, false);
});

test("unknown risk profile fails closed to balanced", () => {
  assert.equal(normalizeAgentRiskProfile("YOLO"), "balanced");
  assert.equal(normalizeAgentRiskProfile(null), "balanced");
});

test("Agent V9 learning waits for a quality sample and never edits probability", () => {
  const insufficient = buildAgentV9Decision({
    pick: strongPick(),
    learning: {
      bySport: {
        soccer_epl: {
          bets: 25,
          roi: 0.3,
          averageClv: 0.02,
          clvCount: 20,
          brierScore: 0.18,
          brierCount: 20,
          calibrationGap: 0.01
        }
      }
    }
  });
  const weak = buildAgentV9Decision({
    pick: strongPick(),
    learning: {
      bySport: {
        soccer_epl: {
          bets: 40,
          roi: -0.12,
          averageClv: -0.02,
          clvCount: 30,
          brierScore: 0.31,
          brierCount: 35,
          calibrationGap: -0.15
        }
      }
    }
  });

  assert.equal(insufficient.learningSignal.status, "insufficient");
  assert.equal(weak.learningSignal.status, "downgrade");
  assert.equal(weak.decision, "WATCH");
  assert.equal(weak.consensusProbability, 0.58);
  assert.equal(weak.probabilityAdjustedByLearning, false);
});

test("Agent V9 portfolio permits only one PLAY per event", () => {
  const portfolio = buildAgentV9Portfolio([
    strongPick({ id: "event-1-home", selection: "Home FC", odds: 2.05 }),
    strongPick({ id: "event-1-away", selection: "Away FC", odds: 2.2 })
  ], {
    bankroll: 1000,
    maxStakePercent: 2,
    maxTotalExposurePercent: 10,
    maxLeagueExposurePercent: 10
  });

  assert.equal(portfolio.decisions.filter((item) => item.decision === "PLAY").length, 1);
  assert.equal(portfolio.decisions.filter((item) => item.portfolioReason?.includes("korreloitunut")).length, 1);
});

test("Agent V9 portfolio obeys total and league exposure caps", () => {
  const picks = Array.from({ length: 5 }, (_, index) => strongPick({
    id: `event-${index}`,
    gameId: `event-${index}`,
    match: `Home ${index} vs Away ${index}`,
    selection: `Home ${index}`,
    sportKey: index < 4 ? "soccer_epl" : "icehockey_nhl",
    league: index < 4 ? "soccer_epl" : "icehockey_nhl"
  }));
  const portfolio = buildAgentV9Portfolio(picks, {
    bankroll: 1000,
    maxStakePercent: 5,
    maxTotalExposurePercent: 3,
    maxLeagueExposurePercent: 1.5
  });

  assert.ok(portfolio.totalAllocated <= 30.001);
  assert.ok(Object.values(portfolio.leagueExposure).every((value) => value <= 15.001));
  assert.ok(portfolio.exposurePercent <= 0.03001);
});

test("Agent learning calculates ROI CLV calibration and Brier score", () => {
  const performance = calculateAgentPerformance([
    {
      result: "win",
      stake: 10,
      odds: 2,
      closingOdds: 1.9,
      modelProbability: 0.6,
      sportKey: "soccer_epl",
      marketKey: "h2h"
    },
    {
      result: "loss",
      stake: 10,
      odds: 2,
      closingOdds: 2.1,
      modelProbability: 0.55,
      sportKey: "soccer_epl",
      marketKey: "h2h"
    }
  ]);

  assert.equal(performance.sampleSize, 2);
  assert.equal(performance.totalStake, 20);
  assert.equal(performance.profit, 0);
  assert.equal(performance.roi, 0);
  assert.ok(Number.isFinite(performance.averageClv));
  assert.ok(Number.isFinite(performance.brierScore));
  assert.ok(Number.isFinite(performance.calibrationGap));
  assert.equal(performance.bySport.soccer_epl.bets, 2);
});
