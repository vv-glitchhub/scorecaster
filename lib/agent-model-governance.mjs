import { applyAutonomyPolicy, buildAutonomyState } from "./autonomous-scorecaster-v12.mjs";

function syntheticSettledHistory(modelLab = null) {
  const count = Math.max(0, Math.min(500, Number(modelLab?.sampleSize || 0)));
  return Array.from({ length: count }, (_, index) => ({
    id: `model-lab-sample-${index}`,
    status: "push",
    stake: 0,
    odds: 2,
    createdAt: new Date(index * 1000).toISOString()
  }));
}

export function applyModelLabSafety(decisions = [], modelLab = null) {
  const selfLearningDecisions = (Array.isArray(decisions) ? decisions : []).map((decision) => ({
    ...decision,
    agentVersion: "V11-model-lab-shadow",
    selfLearning: {
      version: modelLab?.version || "V11-model-lab",
      status: modelLab?.status || "unavailable",
      mode: modelLab?.mode || "shadow-only",
      sampleSize: Number(modelLab?.sampleSize || 0),
      promotionEligible: Boolean(modelLab?.promotion?.eligible),
      driftStatus: modelLab?.drift?.status || "unknown",
      probabilityApplied: false
    }
  }));

  const autonomyState = buildAutonomyState({
    history: syntheticSettledHistory(modelLab),
    decisions: selfLearningDecisions,
    modelLab,
    bankroll: { bankroll: 1000, paperTradingMode: true }
  });

  return applyAutonomyPolicy(selfLearningDecisions, autonomyState);
}

export function summarizeGovernedDecisions(decisions = []) {
  const counts = { PLAY: 0, WATCH: 0, SKIP: 0 };
  let totalAllocated = 0;
  const autonomyModes = {};
  let autonomyBlocked = 0;

  (Array.isArray(decisions) ? decisions : []).forEach((decision) => {
    const key = ["PLAY", "WATCH", "SKIP"].includes(decision.decision)
      ? decision.decision
      : "WATCH";
    counts[key] += 1;
    totalAllocated += Number(decision.allocatedStake || 0);
    const mode = decision.autonomyV12?.mode || "UNKNOWN";
    autonomyModes[mode] = (autonomyModes[mode] || 0) + 1;
    if (decision.autonomyV12?.blocked) autonomyBlocked += 1;
  });

  return {
    counts,
    totalAllocated: Number(totalAllocated.toFixed(2)),
    autonomyModes,
    autonomyBlocked,
    probabilityChangedByAutonomy: false
  };
}
