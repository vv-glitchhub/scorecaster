const PROFILES = Object.freeze({
  standard: Object.freeze({
    id: "standard",
    minBookmakers: 4,
    minConfidence: 0.58,
    minTrust: 0.62,
    minEdge: 0.02,
    minEv: 0.03,
    maxUncertaintyHalfWidth: 0.12,
    allowAgingMarket: true,
    requirePositiveStressedEv: true,
    description: "Professional baseline: four-book coverage, positive stressed EV and disciplined uncertainty gates."
  }),
  selective: Object.freeze({
    id: "selective",
    minBookmakers: 5,
    minConfidence: 0.65,
    minTrust: 0.7,
    minEdge: 0.03,
    minEv: 0.045,
    maxUncertaintyHalfWidth: 0.1,
    allowAgingMarket: false,
    requirePositiveStressedEv: true,
    description: "Selective professional workflow: stronger market coverage, confidence, edge and freshness requirements."
  }),
  volume: Object.freeze({
    id: "volume",
    minBookmakers: 4,
    minConfidence: 0.55,
    minTrust: 0.58,
    minEdge: 0.015,
    minEv: 0.025,
    maxUncertaintyHalfWidth: 0.14,
    allowAgingMarket: true,
    requirePositiveStressedEv: true,
    description: "Higher-volume professional review: accepts more candidates but never relaxes positive stressed EV or core paper-risk caps."
  })
});

const PROFILE_IDS = Object.freeze(Object.keys(PROFILES));

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCoreDecision(value) {
  const decision = String(value || "WATCH").toUpperCase();
  if (decision === "PLAY" || decision === "BET") return "PLAY";
  if (decision === "SKIP" || decision === "PASS") return "SKIP";
  return "WATCH";
}

function freshness(value = {}) {
  return String(value.freshnessLabel || value.dataQuality?.freshness || "unknown").trim().toLowerCase();
}

export function normalizeProfessionalProfile(value) {
  const profile = String(value || "standard").trim().toLowerCase();
  return PROFILE_IDS.includes(profile) ? profile : "standard";
}

export function getProfessionalPolicy(value = "standard") {
  return PROFILES[normalizeProfessionalProfile(value)];
}

export function publicProfessionalPolicy(value = "standard") {
  const policy = getProfessionalPolicy(value);
  return {
    id: policy.id,
    minBookmakers: policy.minBookmakers,
    minConfidence: policy.minConfidence,
    minTrust: policy.minTrust,
    minEdge: policy.minEdge,
    minEv: policy.minEv,
    maxUncertaintyHalfWidth: policy.maxUncertaintyHalfWidth,
    allowAgingMarket: policy.allowAgingMarket,
    requirePositiveStressedEv: policy.requirePositiveStressedEv,
    description: policy.description,
    downgradeOnly: true,
    probabilityAdjusted: false,
    edgeAdjusted: false,
    evAdjusted: false,
    realMoneyBetting: false
  };
}

export function assessProfessionalDecision(decision = {}, profile = "standard", enabled = true) {
  const normalizedProfile = normalizeProfessionalProfile(profile);
  const policy = getProfessionalPolicy(normalizedProfile);
  const coreDecision = normalizeCoreDecision(decision.decision || decision.productDecision);
  const blockers = [];

  const bookmakerCount = finite(decision.bookmakerCount ?? decision.dataQuality?.bookmakerCount);
  const confidence = finite(decision.confidence);
  const trustRaw = finite(decision.trustScore);
  const trust = trustRaw === null ? null : trustRaw > 1 ? trustRaw / 100 : trustRaw;
  const edge = finite(decision.edge);
  const ev = finite(decision.ev ?? decision.stressTest?.baseEv);
  const halfWidth = finite(decision.stressTest?.halfWidth ?? decision.probabilityHalfWidth);
  const downsideEv = finite(decision.stressTest?.downsideEv);
  const marketFreshness = freshness(decision);

  if (bookmakerCount === null) blockers.push("bookmaker coverage is unavailable");
  else if (bookmakerCount < policy.minBookmakers) blockers.push(`bookmaker coverage is below ${policy.minBookmakers}`);

  if (confidence === null) blockers.push("data confidence is unavailable");
  else if (confidence < policy.minConfidence) blockers.push(`data confidence is below ${(policy.minConfidence * 100).toFixed(0)}%`);

  if (trust === null) blockers.push("trust score is unavailable");
  else if (trust < policy.minTrust) blockers.push(`trust score is below ${(policy.minTrust * 100).toFixed(0)}/100`);

  if (edge === null) blockers.push("edge is unavailable");
  else if (edge < policy.minEdge) blockers.push(`edge is below ${(policy.minEdge * 100).toFixed(1)}%`);

  if (ev === null) blockers.push("EV is unavailable");
  else if (ev < policy.minEv) blockers.push(`EV is below ${(policy.minEv * 100).toFixed(1)}%`);

  if (halfWidth === null) blockers.push("probability uncertainty width is unavailable");
  else if (halfWidth > policy.maxUncertaintyHalfWidth) blockers.push("probability uncertainty is wider than the professional policy allows");

  if (policy.requirePositiveStressedEv && (downsideEv === null || downsideEv <= 0)) {
    blockers.push("stressed lower-bound EV is not verified positive");
  }

  if (marketFreshness === "stale") blockers.push("market data is stale");
  if (!policy.allowAgingMarket && marketFreshness === "aging") blockers.push("market data is aging under the selective profile");

  let status = "OFF";
  if (enabled) {
    if (coreDecision === "SKIP") status = "PASS";
    else if (coreDecision === "WATCH") status = "REVIEW";
    else status = blockers.length ? "REVIEW" : "QUALIFIED";
  }

  return {
    enabled: enabled === true,
    profile: normalizedProfile,
    status,
    coreDecision,
    qualified: enabled === true && status === "QUALIFIED",
    blockers,
    paperStakeEligible: enabled === true && status === "QUALIFIED" && Number(decision.suggestedStake || 0) > 0,
    qualifiedPaperStake: enabled === true && status === "QUALIFIED" ? Number(decision.suggestedStake || 0) : 0,
    policy: publicProfessionalPolicy(normalizedProfile),
    probabilityAdjustedByProfessionalMode: false,
    edgeAdjustedByProfessionalMode: false,
    evAdjustedByProfessionalMode: false,
    realMoneyBetting: false
  };
}

export function applyProfessionalQualification(decisions = [], { enabled = true, profile = "standard" } = {}) {
  const normalizedProfile = normalizeProfessionalProfile(profile);
  const rows = (Array.isArray(decisions) ? decisions : []).map((decision) => {
    const professionalAssessment = assessProfessionalDecision(decision, normalizedProfile, enabled);
    return {
      ...decision,
      professionalAssessment,
      professionalQualified: professionalAssessment.qualified,
      professionalProfile: normalizedProfile,
      probabilityAdjustedByProfessionalMode: false,
      edgeAdjustedByProfessionalMode: false,
      evAdjustedByProfessionalMode: false
    };
  });

  const counts = rows.reduce((result, row) => {
    const status = row.professionalAssessment?.status || "OFF";
    result[status] = (result[status] || 0) + 1;
    return result;
  }, { QUALIFIED: 0, REVIEW: 0, PASS: 0, OFF: 0 });

  const qualifiedPaperStake = rows.reduce(
    (sum, row) => sum + Number(row.professionalAssessment?.qualifiedPaperStake || 0),
    0
  );

  return {
    enabled: enabled === true,
    profile: normalizedProfile,
    policy: publicProfessionalPolicy(normalizedProfile),
    counts,
    qualifiedPaperStake: Number(qualifiedPaperStake.toFixed(2)),
    decisions: rows,
    downgradeOnly: true,
    probabilityAdjustedByProfessionalMode: false,
    edgeAdjustedByProfessionalMode: false,
    evAdjustedByProfessionalMode: false,
    realMoneyBetting: false
  };
}

export const PROFESSIONAL_PROFILE_IDS = PROFILE_IDS;
