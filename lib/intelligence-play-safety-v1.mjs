export const VERIFIED_NEGATIVE_IMPACT_THRESHOLD = -0.015;

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function evaluateIndependentIntelligenceSafetyV1({ report = {}, relativeImpact = 0 } = {}) {
  const readiness = String(report?.readiness?.level || "market-only");
  const verified = readiness === "verified";
  const conflicts = Array.isArray(report?.conflicts) ? report.conflicts : [];
  const impact = finite(relativeImpact, 0);
  const negativeVerifiedEvidence = verified && impact <= VERIFIED_NEGATIVE_IMPACT_THRESHOLD;
  const criticalConflict = conflicts.length > 0;
  const downgrade = negativeVerifiedEvidence || criticalConflict;
  const reasonCodes = [];

  if (negativeVerifiedEvidence) reasonCodes.push("intelligence-negative-verified");
  if (criticalConflict) reasonCodes.push("intelligence-conflict");

  return {
    version: "intelligence-play-safety-v1",
    readiness,
    verified,
    relativeImpact: impact,
    negativeVerifiedEvidence,
    criticalConflict,
    downgrade,
    reasonCodes,
    missingEvidenceIsDowngrade: false,
    probabilityAdjusted: false,
    marketProbabilityChanged: false,
    canUpgradeMarketDecision: false,
    downgradeOnly: true
  };
}

export const INTELLIGENCE_PLAY_SAFETY_POLICY_V1 = Object.freeze({
  missingEvidenceIsDowngrade: false,
  verifiedNegativeImpactThreshold: VERIFIED_NEGATIVE_IMPACT_THRESHOLD,
  unresolvedConflictDowngradesPlay: true,
  canUpgradeMarketDecision: false,
  probabilityAdjusted: false,
  marketProbabilityChanged: false,
  paperOnly: true
});
