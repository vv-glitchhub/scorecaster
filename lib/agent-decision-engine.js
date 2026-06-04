export function determineDecision({
  edge = 0,
  ev = 0,
  confidence = "Low",
  riskLevel = "Medium",
  sourceTrust = 0.5
}) {
  const edgePct = Number(edge || 0) * 100;
  const evPct = Number(ev || 0) * 100;

  if (
    edgePct >= 8 &&
    evPct >= 6 &&
    ["High", "Medium-high"].includes(confidence) &&
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
    ["High", "Medium-high", "Medium"].includes(confidence) &&
    riskLevel !== "High"
  ) {
    return {
      decision: "WATCH",
      reason:
        "Potential value detected, but the case still needs confirmation before betting."
    };
  }

  if (riskLevel === "High" || sourceTrust < 0.4) {
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
