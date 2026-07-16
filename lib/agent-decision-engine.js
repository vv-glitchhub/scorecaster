function normalizeConfidence(confidence) {
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    return Math.max(0, Math.min(1, confidence));
  }

  const numeric = Number(confidence);
  if (Number.isFinite(numeric) && String(confidence).trim() !== "") {
    return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
  }

  const labels = {
    High: 0.85,
    "Medium-high": 0.7,
    Medium: 0.55,
    "Low-medium": 0.4,
    Low: 0.25
  };

  return labels[confidence] ?? 0.25;
}

export function determineDecision({
  edge = 0,
  ev = 0,
  confidence = 0.25,
  riskLevel = "Medium",
  sourceTrust = 0.5
}) {
  const edgePct = Number(edge || 0) * 100;
  const evPct = Number(ev || 0) * 100;
  const confidenceScore = normalizeConfidence(confidence);

  if (
    edgePct >= 8 &&
    evPct >= 6 &&
    confidenceScore >= 0.7 &&
    sourceTrust >= 0.7 &&
    riskLevel !== "High"
  ) {
    return {
      decision: "BET",
      reason:
        "Strong edge, positive expected value, trusted context and acceptable risk."
    };
  }

  if (
    edgePct >= 5 &&
    evPct >= 3 &&
    confidenceScore >= 0.5 &&
    riskLevel !== "High"
  ) {
    return {
      decision: "WATCH",
      reason:
        "Potential value detected, but the case still needs confirmation before betting."
    };
  }

  if (riskLevel === "High" || sourceTrust < 0.4 || confidenceScore < 0.35) {
    return {
      decision: "WAIT",
      reason:
        "Too much uncertainty. Wait for better source quality, lineup confirmation or market movement."
    };
  }

  return {
    decision: "PASS",
    reason: "No clear betting advantage after risk and context adjustment."
  };
}
