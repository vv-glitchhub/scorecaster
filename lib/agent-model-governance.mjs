import { applyVerifiedContextGovernance } from "./agent-context-governance.mjs";

export function applyModelLabSafety(decisions = [], modelLab = null) {
  const freeze = modelLab?.drift?.status === "critical";
  const modelGoverned = (Array.isArray(decisions) ? decisions : []).map((decision) => {
    const selfLearning = {
      version: modelLab?.version || "V11-model-lab",
      status: modelLab?.status || "unavailable",
      mode: modelLab?.mode || "shadow-only",
      sampleSize: Number(modelLab?.sampleSize || 0),
      promotionEligible: Boolean(modelLab?.promotion?.eligible),
      driftStatus: modelLab?.drift?.status || "unknown",
      probabilityApplied: false
    };

    if (!freeze || decision.decision !== "PLAY") {
      return {
        ...decision,
        agentVersion: "V11-model-lab-shadow",
        selfLearning
      };
    }

    return {
      ...decision,
      agentVersion: "V11-model-lab-shadow",
      decision: "WATCH",
      suggestedStake: 0,
      allocatedStake: 0,
      portfolioReason: "Mallidriftin turvaportti jäädytti uuden paperialtistuksen.",
      blockers: [...(decision.blockers || []), "kriittinen mallidrift"],
      selfLearning
    };
  });

  return applyVerifiedContextGovernance(modelGoverned);
}

export function summarizeGovernedDecisions(decisions = []) {
  const counts = { PLAY: 0, WATCH: 0, SKIP: 0 };
  let totalAllocated = 0;

  (Array.isArray(decisions) ? decisions : []).forEach((decision) => {
    const key = ["PLAY", "WATCH", "SKIP"].includes(decision.decision)
      ? decision.decision
      : "WATCH";
    counts[key] += 1;
    totalAllocated += Number(decision.allocatedStake || 0);
  });

  return {
    counts,
    totalAllocated: Number(totalAllocated.toFixed(2))
  };
}
