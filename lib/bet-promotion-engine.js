export function promoteBetDecision(pick = {}) {
  const edge = Number(pick.edge || 0);
  const finalScore = Number(pick.finalScore || 0);
  const qualityScore = Number(pick.qualityScore || 0);
  const qualityGrade = pick.qualityGrade || "N/A";
  const sourceTrust = Number(pick.sourceTrust || 0.45);
  const sentimentScore = Number(pick.sentimentScore || 0);
  const riskLevel = pick.riskLevel || "Medium";

  const notes = [];
  let decision = pick.decision || "WATCH";
  let promotionScore = 0;

  if (edge >= 0.06) {
    promotionScore += 0.35;
    notes.push("Edge is strong enough for BET consideration.");
  } else if (edge >= 0.045) {
    promotionScore += 0.25;
    notes.push("Edge is acceptable for WATCH/BET boundary.");
  }

  if (["A", "B"].includes(qualityGrade)) {
    promotionScore += 0.25;
    notes.push("Quality grade supports promotion.");
  } else if (qualityGrade === "C") {
    promotionScore += 0.12;
    notes.push("Quality grade supports watchlist, not automatic BET.");
  }

  if (qualityScore >= 0.55) promotionScore += 0.15;
  else if (qualityScore >= 0.45) promotionScore += 0.08;

  if (sourceTrust >= 0.7) promotionScore += 0.12;
  else if (sourceTrust >= 0.45) promotionScore += 0.06;

  if (sentimentScore > 0.02) promotionScore += 0.08;
  if (sentimentScore < -0.02) promotionScore -= 0.12;

  if (riskLevel === "High") {
    promotionScore -= 0.25;
    notes.push("High risk blocks aggressive promotion.");
  }

  if (finalScore >= 0.095) promotionScore += 0.1;

  if (promotionScore >= 0.72 && edge >= 0.045 && riskLevel !== "High") {
    decision = "BET";
    notes.push("Promoted to BET by promotion engine.");
  } else if (promotionScore >= 0.35) {
    decision = decision === "BET" ? "BET" : "WATCH";
    notes.push("Kept as WATCH by promotion engine.");
  } else if (finalScore < 0.02) {
    decision = "PASS";
    notes.push("Rejected by promotion engine.");
  }

  return {
    decision,
    promotionScore: clamp(promotionScore, -1, 1),
    promotionNotes: notes
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
