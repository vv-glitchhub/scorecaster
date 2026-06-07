export function applyAgentV8AdaptiveWeights({ picks = [], adaptiveWeights = null }) {
  const weights = normalizeWeights(adaptiveWeights);

  const adjusted = picks.map((pick) => {
    const edge = Number(pick.edge || 0);
    const qualityScore = Number(pick.qualityScore || 0);
    const sourceTrust = Number(pick.sourceTrust || 0.45);
    const sentimentScore = Number(pick.sentimentScore || 0);
    const baseFinalScore = Number(pick.finalScore || 0);

    const adaptiveScore =
      edge * (weights.edgeWeight - 1) +
      qualityScore * 0.08 * (weights.qualityWeight - 1) +
      sourceTrust * 0.04 * (weights.trustWeight - 1) +
      sentimentScore * 0.5;

    const finalScoreV8 = baseFinalScore + adaptiveScore;
    const decisionV8 = decideV8({
      pick,
      finalScoreV8,
      adaptiveScore,
      riskMode: weights.riskMode
    });

    return {
      ...pick,
      agentVersion: "V8",
      previousAgentVersion: pick.agentVersion || "V7",
      baseDecision: pick.decision,
      decision: decisionV8,
      finalScoreV7: baseFinalScore,
      finalScore: finalScoreV8,
      adaptiveScore,
      adaptiveWeights: weights,
      adaptiveNotes: buildAdaptiveNotes({ weights, adaptiveScore, decisionV8 })
    };
  });

  return adjusted.sort((a, b) => rankV8(b) - rankV8(a));
}

function normalizeWeights(weights = null) {
  return {
    edgeWeight: Number(weights?.edgeWeight || 1),
    qualityWeight: Number(weights?.qualityWeight || 1),
    trustWeight: Number(weights?.trustWeight || 1),
    riskMode: weights?.riskMode || "balanced"
  };
}

function decideV8({ pick, finalScoreV8, adaptiveScore, riskMode }) {
  const edge = Number(pick.edge || 0);
  const qualityGrade = pick.qualityGrade || "N/A";
  const sourceTrust = Number(pick.sourceTrust || 0.45);

  if (riskMode === "defensive") {
    if (pick.decision === "BET" && finalScoreV8 >= 0.11 && edge >= 0.05) return "BET";
    if (finalScoreV8 >= 0.045) return "WATCH";
    return "WAIT";
  }

  if (riskMode === "aggressive") {
    if (["A", "B", "C"].includes(qualityGrade) && edge >= 0.045 && finalScoreV8 >= 0.055) return "BET";
    if (finalScoreV8 >= 0.035) return "WATCH";
    return "WAIT";
  }

  if (["A", "B"].includes(qualityGrade) && edge >= 0.045 && finalScoreV8 >= 0.06 && sourceTrust >= 0.45) {
    return "BET";
  }

  if (qualityGrade === "C" && edge >= 0.05 && adaptiveScore > 0.005 && finalScoreV8 >= 0.058) {
    return "BET";
  }

  if (finalScoreV8 >= 0.04) return "WATCH";
  return "WAIT";
}

function rankV8(pick) {
  const decisionWeight = {
    BET: 1,
    WATCH: 0.45,
    WAIT: 0.1,
    PASS: -1
  };

  return (
    Number(pick.finalScore || 0) +
    Number(pick.edge || 0) +
    Number(pick.qualityScore || 0) * 0.12 +
    Number(pick.sourceTrust || 0) * 0.02 +
    Number(decisionWeight[pick.decision] || 0)
  );
}

function buildAdaptiveNotes({ weights, adaptiveScore, decisionV8 }) {
  return [
    `Agent V8 risk mode: ${weights.riskMode}.`,
    `Adaptive score adjustment: ${adaptiveScore.toFixed(4)}.`,
    `Edge weight: ${weights.edgeWeight}.`,
    `Quality weight: ${weights.qualityWeight}.`,
    `Trust weight: ${weights.trustWeight}.`,
    `Agent V8 decision: ${decisionV8}.`
  ];
}
