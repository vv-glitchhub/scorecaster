function safeText(value, maxLength = 220) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function unique(items, maximum = 12) {
  return [...new Set(items.map((item) => safeText(item)).filter(Boolean))].slice(0, maximum);
}

function reportFromDecision(decision = {}) {
  return decision.verifiedIntelligence && typeof decision.verifiedIntelligence === "object"
    ? decision.verifiedIntelligence
    : decision.sportsIntelligence && typeof decision.sportsIntelligence === "object"
      ? decision.sportsIntelligence
      : null;
}

function verifiedEvidence(report) {
  if (!report || !Array.isArray(report.evidence)) return [];
  return report.evidence
    .filter((item) => item?.verified === true && item?.category !== "external_market")
    .slice(0, 5)
    .map((item) => {
      const category = safeText(item.category, 40) || "context";
      const subject = safeText(item.subject, 100) || "verified item";
      const status = safeText(item.status, 60) || "observed";
      const source = safeText(item.source, 80) || "verified source";
      const freshness = safeText(item.freshness, 30) || "unknown freshness";
      return `${category}: ${subject} — ${status}; source ${source}; ${freshness}.`;
    });
}

function blockingReasons(report) {
  if (!report) return [];
  const reasons = Array.isArray(report.playGate?.reasons)
    ? report.playGate.reasons
    : [];
  if (report.status === "not_evaluated") {
    reasons.push("verified sports context was not evaluated within the bounded request limit");
  }
  return unique(reasons, 6);
}

function missingEvidence(report) {
  if (!report) return [];
  const missing = Array.isArray(report.missing) ? [...report.missing] : [];
  if (report.status === "not_evaluated") missing.push("verified sports-context evaluation");
  return unique(missing, 8);
}

export function applyVerifiedContextGovernance(decisions = []) {
  return (Array.isArray(decisions) ? decisions : []).map((decision) => {
    const report = reportFromDecision(decision);
    const reasons = blockingReasons(report);
    const evidence = unique([
      ...(Array.isArray(decision.evidence) ? decision.evidence : []),
      ...verifiedEvidence(report)
    ], 10);
    const missing = unique([
      ...(Array.isArray(decision.missingEvidence) ? decision.missingEvidence : []),
      ...missingEvidence(report)
    ], 10);
    const counterArguments = unique([
      ...(Array.isArray(decision.counterArguments) ? decision.counterArguments : []),
      ...reasons.map((reason) => `Verified sports context blocks PLAY: ${reason}.`)
    ], 10);
    const downgrade = decision.decision === "PLAY" && reasons.length > 0;

    return {
      ...decision,
      decision: downgrade ? "WATCH" : decision.decision,
      suggestedStake: downgrade ? 0 : Number(decision.suggestedStake || 0),
      allocatedStake: downgrade ? 0 : Number(decision.allocatedStake || decision.suggestedStake || 0),
      evidence,
      missingEvidence: missing,
      counterArguments,
      blockers: unique([
        ...(Array.isArray(decision.blockers) ? decision.blockers : []),
        ...reasons.map((reason) => `sports context: ${reason}`)
      ]),
      portfolioReason: downgrade
        ? "Verified sports context downgraded PLAY to WATCH and removed the planned paper allocation."
        : decision.portfolioReason || null,
      contextGovernance: {
        version: "real-sports-intelligence-v1",
        status: report?.status || "unavailable",
        readiness: report?.readiness || "low",
        coverageScore: Number(report?.coverageScore || 0),
        blocked: reasons.length > 0,
        reasons,
        probabilityAdjusted: false,
        edgeAdjusted: false,
        evAdjusted: false,
        decisionPromoted: false
      },
      probabilityAdjustedByContext: false
    };
  });
}
