import assert from "node:assert/strict";
import {
  applyProfessionalQualification,
  assessProfessionalDecision,
  normalizeProfessionalProfile,
  publicProfessionalPolicy
} from "../lib/pro-bettor-policy-v1.mjs";

const strongPlay = {
  id: "strong",
  decision: "PLAY",
  bookmakerCount: 6,
  confidence: 0.72,
  trustScore: 78,
  edge: 0.042,
  ev: 0.061,
  freshnessLabel: "fresh",
  suggestedStake: 8.5,
  stressTest: {
    halfWidth: 0.075,
    downsideEv: 0.021
  }
};

assert.equal(normalizeProfessionalProfile("selective"), "selective");
assert.equal(normalizeProfessionalProfile("unknown"), "standard");

{
  const policy = publicProfessionalPolicy("standard");
  assert.equal(policy.downgradeOnly, true);
  assert.equal(policy.probabilityAdjusted, false);
  assert.equal(policy.edgeAdjusted, false);
  assert.equal(policy.evAdjusted, false);
  assert.equal(policy.realMoneyBetting, false);
}

{
  const assessment = assessProfessionalDecision(strongPlay, "selective", true);
  assert.equal(assessment.status, "QUALIFIED");
  assert.equal(assessment.qualified, true);
  assert.equal(assessment.qualifiedPaperStake, 8.5);
  assert.equal(assessment.blockers.length, 0);
}

{
  const borderlinePlay = {
    ...strongPlay,
    id: "borderline",
    bookmakerCount: 4,
    confidence: 0.6,
    trustScore: 64,
    edge: 0.023,
    ev: 0.034,
    stressTest: { halfWidth: 0.11, downsideEv: 0.006 }
  };
  const standard = assessProfessionalDecision(borderlinePlay, "standard", true);
  const selective = assessProfessionalDecision(borderlinePlay, "selective", true);
  assert.equal(standard.status, "QUALIFIED");
  assert.equal(selective.status, "REVIEW");
  assert.equal(selective.qualifiedPaperStake, 0);
  assert.equal(borderlinePlay.decision, "PLAY");
}

{
  const watch = assessProfessionalDecision({ ...strongPlay, decision: "WATCH" }, "volume", true);
  assert.equal(watch.status, "REVIEW");
  assert.equal(watch.qualified, false);
}

{
  const skip = assessProfessionalDecision({ ...strongPlay, decision: "SKIP" }, "volume", true);
  assert.equal(skip.status, "PASS");
  assert.equal(skip.qualified, false);
}

{
  const badStress = assessProfessionalDecision({
    ...strongPlay,
    stressTest: { halfWidth: 0.08, downsideEv: -0.002 }
  }, "volume", true);
  assert.equal(badStress.status, "REVIEW");
  assert.equal(badStress.blockers.some((item) => item.includes("stressed lower-bound EV")), true);
}

{
  const missing = assessProfessionalDecision({ decision: "PLAY", suggestedStake: 9 }, "standard", true);
  assert.equal(missing.status, "REVIEW");
  assert.equal(missing.qualifiedPaperStake, 0);
  assert.equal(missing.blockers.length >= 6, true);
}

{
  const off = assessProfessionalDecision(strongPlay, "standard", false);
  assert.equal(off.status, "OFF");
  assert.equal(off.qualified, false);
  assert.equal(off.qualifiedPaperStake, 0);
}

{
  const originalProbability = 0.57;
  const originalEdge = strongPlay.edge;
  const originalEv = strongPlay.ev;
  const portfolio = applyProfessionalQualification([
    { ...strongPlay, consensusProbability: originalProbability },
    { ...strongPlay, id: "watch", decision: "WATCH", suggestedStake: 0 }
  ], { enabled: true, profile: "selective" });
  assert.equal(portfolio.counts.QUALIFIED, 1);
  assert.equal(portfolio.counts.REVIEW, 1);
  assert.equal(portfolio.qualifiedPaperStake, 8.5);
  assert.equal(portfolio.decisions[0].decision, "PLAY");
  assert.equal(portfolio.decisions[0].consensusProbability, originalProbability);
  assert.equal(portfolio.decisions[0].edge, originalEdge);
  assert.equal(portfolio.decisions[0].ev, originalEv);
  assert.equal(portfolio.probabilityAdjustedByProfessionalMode, false);
  assert.equal(portfolio.edgeAdjustedByProfessionalMode, false);
  assert.equal(portfolio.evAdjustedByProfessionalMode, false);
  assert.equal(portfolio.realMoneyBetting, false);
}

console.log("Professional bettor policy regression tests passed");
