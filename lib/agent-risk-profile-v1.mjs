export const AGENT_RISK_PROFILE_VERSION = "scorecaster-agent-risk-profile-v1";

export const AGENT_RISK_HARD_CAPS = Object.freeze({
  maxStakePercent: 1,
  maxTotalExposurePercent: 5,
  maxLeagueExposurePercent: 2.5
});

export const AGENT_RISK_PROFILES = Object.freeze({
  conservative: Object.freeze({
    id: "conservative",
    recommendationLevel: "low-risk",
    minConfidence: 0.68,
    minTrust: 0.72,
    minEdge: 0.03,
    minEv: 0.045,
    maxUncertaintyHalfWidth: 0.09,
    requireRobustPositive: true,
    kellyFraction: 0.125,
    stakeMultiplier: 0.5,
    totalExposureMultiplier: 0.5,
    leagueExposureMultiplier: 0.5
  }),
  balanced: Object.freeze({
    id: "balanced",
    recommendationLevel: "balanced-risk",
    minConfidence: 0.55,
    minTrust: 0.62,
    minEdge: 0.02,
    minEv: 0.03,
    maxUncertaintyHalfWidth: 0.12,
    requireRobustPositive: true,
    kellyFraction: 0.25,
    stakeMultiplier: 1,
    totalExposureMultiplier: 1,
    leagueExposureMultiplier: 1
  }),
  aggressive: Object.freeze({
    id: "aggressive",
    recommendationLevel: "higher-risk",
    minConfidence: 0.5,
    minTrust: 0.58,
    minEdge: 0.015,
    minEv: 0.02,
    maxUncertaintyHalfWidth: 0.14,
    requireRobustPositive: true,
    kellyFraction: 1 / 3,
    stakeMultiplier: 1,
    totalExposureMultiplier: 1.25,
    leagueExposureMultiplier: 1.25
  })
});

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAgentRiskProfile(value) {
  const normalized = String(value || "balanced").trim().toLowerCase();
  return Object.hasOwn(AGENT_RISK_PROFILES, normalized) ? normalized : "balanced";
}

export function getAgentRiskPolicy(value) {
  return AGENT_RISK_PROFILES[normalizeAgentRiskProfile(value)];
}

export function getEffectiveAgentRiskLimits({
  riskProfile = "balanced",
  maxStakePercent = 1,
  maxTotalExposurePercent = 4,
  maxLeagueExposurePercent = 2
} = {}) {
  const policy = getAgentRiskPolicy(riskProfile);
  const baseStake = clamp(finite(maxStakePercent, 1), 0.1, 5);
  const baseTotal = clamp(finite(maxTotalExposurePercent, 4), 0.5, 20);
  const baseLeague = clamp(finite(maxLeagueExposurePercent, 2), 0.25, 10);

  return Object.freeze({
    maxStakePercent: Number(Math.min(
      AGENT_RISK_HARD_CAPS.maxStakePercent,
      baseStake * policy.stakeMultiplier
    ).toFixed(3)),
    maxTotalExposurePercent: Number(Math.min(
      AGENT_RISK_HARD_CAPS.maxTotalExposurePercent,
      baseTotal * policy.totalExposureMultiplier
    ).toFixed(3)),
    maxLeagueExposurePercent: Number(Math.min(
      AGENT_RISK_HARD_CAPS.maxLeagueExposurePercent,
      baseLeague * policy.leagueExposureMultiplier
    ).toFixed(3))
  });
}

export function publicAgentRiskPolicy(value) {
  const policy = getAgentRiskPolicy(value);
  return Object.freeze({
    version: AGENT_RISK_PROFILE_VERSION,
    id: policy.id,
    recommendationLevel: policy.recommendationLevel,
    minConfidence: policy.minConfidence,
    minTrust: policy.minTrust,
    minEdge: policy.minEdge,
    minEv: policy.minEv,
    maxUncertaintyHalfWidth: policy.maxUncertaintyHalfWidth,
    requireRobustPositive: policy.requireRobustPositive,
    kellyFraction: Number(policy.kellyFraction.toFixed(4)),
    probabilityChanged: false,
    edgeChanged: false,
    evChanged: false,
    realMoneyActionAvailable: false,
    paperOnly: true
  });
}
