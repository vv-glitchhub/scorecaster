export function calculatePickQuality(pick = {}) {
  const edge = Number(pick.edge || 0);
  const finalScore = Number(pick.finalScore || 0);
  const odds = Number(pick.odds || 0);
  const sourceTrust = Number(pick.sourceTrust ?? 0.4);
  const sentiment = Number(pick.sentimentScore || 0);

  let qualityScore = 0;
  const notes = [];

  if (edge >= 0.08) {
    qualityScore += 0.35;
    notes.push("Strong edge detected.");
  } else if (edge >= 0.05) {
    qualityScore += 0.25;
    notes.push("Good edge detected.");
  } else if (edge >= 0.03) {
    qualityScore += 0.12;
    notes.push("Small positive edge detected.");
  }

  if (finalScore >= 0.12) qualityScore += 0.25;
  else if (finalScore >= 0.08) qualityScore += 0.15;
  else if (finalScore >= 0.045) qualityScore += 0.08;

  if (odds >= 1.55 && odds <= 2.4) {
    qualityScore += 0.12;
    notes.push("Odds are inside preferred range.");
  } else if (odds > 2.4 && odds <= 3.2) {
    qualityScore += 0.04;
    notes.push("Higher variance odds range.");
  } else if (odds > 0) {
    qualityScore -= 0.05;
    notes.push("Odds are outside preferred range.");
  }

  if (sourceTrust >= 0.7) qualityScore += 0.12;
  else if (sourceTrust >= 0.4) qualityScore += 0.04;
  else qualityScore -= 0.04;

  if (sentiment > 0.015) qualityScore += 0.08;
  if (sentiment < -0.015) qualityScore -= 0.08;

  const grade = gradeQuality(qualityScore);

  return {
    qualityScore: clamp(qualityScore, 0, 1),
    qualityGrade: grade,
    qualityNotes: notes
  };
}

function gradeQuality(score) {
  if (score >= 0.75) return "A";
  if (score >= 0.55) return "B";
  if (score >= 0.35) return "C";
  if (score >= 0.2) return "D";
  return "F";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
