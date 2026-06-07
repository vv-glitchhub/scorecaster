export function calculateAgentScoreV9({ pick = {}, learning = null } = {}) {
  const weights = learning?.weights || {};

  const edgeComponent = normalizePositive(pick.edge, 0.12) * 18 * Number(weights.edgeWeight || 1);
  const evComponent = normalizePositive(pick.ev, 0.25) * 14;
  const qualityComponent = normalizePositive(pick.qualityScore, 1) * 14 * Number(weights.qualityWeight || 1);
  const trustComponent = normalizePositive(pick.sourceTrust, 1) * 10 * Number(weights.trustWeight || 1);
  const sentimentComponent = normalizeSigned(pick.sentimentScore, 0.08) * 8;
  const contextComponent = normalizeSigned(pick.matchContextScore, 0.12) * 12 * Number(weights.contextWeight || 1);
  const sharpComponent = normalizeSigned(pick.sharpMoneyScore, 0.08) * 12 * Number(weights.sharpWeight || 1);
  const clvComponent = normalizeSigned(pick.clvPercent, 5) * 8 * Number(weights.clvWeight || 1);

  const rawScore =
    50 +
    edgeComponent +
    evComponent +
    qualityComponent +
    trustComponent +
    sentimentComponent +
    contextComponent +
    sharpComponent +
    clvComponent +
    decisionBias(pick.decision);

  const finalScore100 = clamp(rawScore, 0, 100);
  const grade = gradeScore(finalScore100);
  const decision = decideV9({ score: finalScore100, grade, pick, riskMode: weights.riskMode || "balanced" });

  return {
    agentVersion: "V9",
    finalScore100,
    grade,
    decision,
    previousDecision: pick.decision,
    riskMode: weights.riskMode || "balanced",
    components: {
      edgeComponent,
      evComponent,
      qualityComponent,
      trustComponent,
      sentimentComponent,
      contextComponent,
      sharpComponent,
      clvComponent
    },
    weights: {
      edgeWeight: Number(weights.edgeWeight || 1),
      qualityWeight: Number(weights.qualityWeight || 1),
      trustWeight: Number(weights.trustWeight || 1),
      clvWeight: Number(weights.clvWeight || 1),
      sharpWeight: Number(weights.sharpWeight || 1),
      contextWeight: Number(weights.contextWeight || 1)
    },
    notes: buildScoreNotes({ pick, finalScore100, grade, decision })
  };
}

export function applyAgentScoreV9({ picks = [], learning = null } = {}) {
  return [...picks]
    .map((pick) => {
      const v9 = calculateAgentScoreV9({ pick, learning });
      return {
        ...pick,
        agentVersion: "V9",
        finalScore100: v9.finalScore100,
        gradeV9: v9.grade,
        decisionV9: v9.decision,
        decision: v9.decision,
        scoreV9: v9,
        rankScore: v9.finalScore100
      };
    })
    .sort((a, b) => Number(b.rankScore || 0) - Number(a.rankScore || 0))
    .map((pick, index) => ({ ...pick, rankV9: index + 1 }));
}

function decideV9({ score, grade, pick, riskMode }) {
  const riskLevel = pick.riskLevel || "Medium";
  const readiness = pick.readiness?.level || pick.readinessLevel || "Medium";

  if (riskMode === "defensive" && score < 82) return score >= 68 ? "WATCH" : "WAIT";
  if (riskLevel === "High" && score < 84) return "WAIT";
  if (readiness === "Low" && score < 80) return "WAIT";

  if (["A+", "A"].includes(grade) && score >= 82) return "BET";
  if (grade === "B" && score >= 72) return "WATCH";
  if (score >= 62) return "WAIT";
  return "PASS";
}

function buildScoreNotes({ pick, finalScore100, grade, decision }) {
  const notes = [
    `Agent V9 score: ${finalScore100.toFixed(1)} / 100.`,
    `Agent V9 grade: ${grade}.`,
    `Agent V9 decision: ${decision}.`
  ];

  if (Number(pick.edge || 0) > 0.05) notes.push("Positive edge supports the score.");
  if (Number(pick.sharpMoneyScore || 0) > 0.02) notes.push("Sharp money supports the selection.");
  if (Number(pick.matchContextScore || 0) > 0.02) notes.push("Match context supports the selection.");
  if (Number(pick.clvPercent || 0) > 1) notes.push("Positive CLV profile supports similar setups.");
  if (pick.riskLevel === "High") notes.push("High risk limits aggressive promotion.");

  return notes;
}

function decisionBias(decision) {
  if (decision === "BET") return 6;
  if (decision === "WATCH") return 2;
  if (decision === "WAIT") return -2;
  if (decision === "PASS") return -6;
  return 0;
}

function normalizePositive(value, max) {
  return clamp(Number(value || 0) / Number(max || 1), 0, 1);
}

function normalizeSigned(value, maxAbs) {
  return clamp(Number(value || 0) / Number(maxAbs || 1), -1, 1);
}

function gradeScore(score) {
  if (score >= 90) return "A+";
  if (score >= 82) return "A";
  if (score >= 72) return "B";
  if (score >= 62) return "C";
  if (score >= 50) return "D";
  return "F";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
