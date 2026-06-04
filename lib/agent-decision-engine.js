export function determineDecision({
  edge = 0,
  ev = 0,
  confidence = "Low",
  riskLevel = "Medium",
  sourceTrust = 0.5
}) {
  const edgePct = edge * 100;
  const evPct = ev * 100;

  if (
    edgePct >= 8 &&
    evPct >= 8 &&
    confidence === "High" &&
    sourceTrust >= 0.7 &&
    riskLevel !== "High"
  ) {
    return {
      decision: "BET",
      reason: "Strong edge, positive EV and high confidence."
    };
  }

  if (
    edgePct >= 5 &&
    evPct >= 3 &&
    ["High", "Medium-high"].includes(confidence)
  ) {
    return {
      decision: "WATCH",
      reason: "Potential value but conditions are not perfect."
    };
  }

  if (
    riskLevel === "High" ||
    sourceTrust < 0.4
  ) {
    return {
      decision: "WAIT",
      reason: "Too much uncertainty. Wait for more information."
    };
  }

  return {
    decision: "PASS",
    reason: "No clear betting advantage."
  };
}
