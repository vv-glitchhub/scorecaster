const BAD_STATUSES = new Set([
  "missing",
  "unavailable",
  "not-configured",
  "not_configured",
  "not-verified",
  "not_verified",
  "source-unavailable",
  "fetch_error",
  "api_error"
]);

const MIN_AI_CONFIDENCE = 0.45;
const MIN_AI_TRUST = 0.55;
const MAX_ITEMS = 6;

function clean(value, limit = 260) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  const number = finite(value, 0);
  return Math.max(min, Math.min(max, number));
}

function round(value, digits = 3) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function unique(items, maximum = MAX_ITEMS) {
  return [...new Set((Array.isArray(items) ? items : []).map((item) => clean(item, 360)).filter(Boolean))].slice(0, maximum);
}

function eventId(pick = {}, ledger = {}) {
  return clean(pick.gameId || pick.eventId || pick.id || ledger.eventId, 180) || null;
}

function factorSources(factor = {}) {
  return (Array.isArray(factor.sources) ? factor.sources : [])
    .map((source) => ({
      provider: clean(source?.provider || source?.name, 120) || "unknown",
      type: clean(source?.type, 80) || "unknown",
      trust: round(clamp(source?.trust, 0, 1), 3),
      observedAt: source?.observedAt || null,
      mode: clean(source?.mode, 40) || "unknown"
    }))
    .slice(0, 8);
}

function chronologyState(factor = {}, pick = {}, now = Date.now()) {
  const commence = timestamp(pick.commenceTime || pick.commence_time);
  const horizon = commence === null ? now : Math.min(now, commence);
  const sourceTimes = factorSources(factor)
    .map((source) => timestamp(source.observedAt))
    .filter((value) => value !== null);

  if (!sourceTimes.length) return { valid: true, checked: false, futureSourceCount: 0 };
  const futureSourceCount = sourceTimes.filter((value) => value > horizon + 60_000).length;
  return { valid: futureSourceCount === 0, checked: true, futureSourceCount };
}

function eligibility(factor = {}, pick = {}, now = Date.now()) {
  const status = clean(factor.status, 60).toLowerCase();
  const confidence = clamp(factor.confidence, 0, 1);
  const trust = clamp(factor.trust, 0, 1);
  const chronology = chronologyState(factor, pick, now);
  const reasons = [];

  if (factor.usedByAi !== true) reasons.push("not marked for AI use");
  if (BAD_STATUSES.has(status)) reasons.push(`status ${status || "unknown"}`);
  if (confidence < MIN_AI_CONFIDENCE) reasons.push(`confidence below ${MIN_AI_CONFIDENCE}`);
  if (trust < MIN_AI_TRUST) reasons.push(`trust below ${MIN_AI_TRUST}`);
  if (!chronology.valid) reasons.push("future-dated source evidence");

  return {
    eligible: reasons.length === 0,
    reasons,
    confidence: round(confidence, 3),
    trust: round(trust, 3),
    chronology
  };
}

function compactFactor(factor = {}, pick = {}, now = Date.now()) {
  const gate = eligibility(factor, pick, now);
  return {
    key: clean(factor.key, 80) || "unknown",
    title: clean(factor.title, 160) || clean(factor.key, 80) || "Unknown factor",
    status: clean(factor.status, 60) || "unknown",
    confidence: gate.confidence,
    trust: gate.trust,
    impact: round(clamp(factor.impact, -0.06, 0.06), 4),
    direction: clean(factor.direction, 30) || "neutral",
    useMode: clean(factor.useMode, 80) || "unknown",
    downgradeEligible: factor.downgradeEligible === true,
    reason: clean(factor.reason, 420),
    eligibleForAi: gate.eligible,
    ignoredReasons: gate.reasons,
    chronology: gate.chronology,
    sources: factorSources(factor)
  };
}

function evidenceLine(factor) {
  const signal = factor.direction === "negative" || factor.direction === "risk"
    ? "Adverse"
    : factor.direction === "positive"
      ? "Supportive"
      : "Neutral";
  const impact = finite(factor.impact, 0);
  const impactText = Math.abs(impact) >= 0.0005 ? ` Bounded context impact ${(impact * 100).toFixed(2)} pp.` : "";
  return `${factor.title}: ${signal.toLowerCase()} verified evidence (trust ${(factor.trust * 100).toFixed(0)}%, confidence ${(factor.confidence * 100).toFixed(0)}%). ${factor.reason}${impactText}`.trim();
}

function ignoredLine(factor) {
  const reason = factor.ignoredReasons.join(", ") || "not eligible";
  return `${factor.title} is not used by AI because ${reason}.`;
}

function missingFromLedger(ledger = {}) {
  return unique((Array.isArray(ledger.missingData) ? ledger.missingData : []).map((item) => {
    if (typeof item === "string") return item;
    return item?.reason || item?.factor || item?.title || item?.missing;
  }), 12);
}

function trustSummary(eligible = []) {
  if (!eligible.length) return { score: 0, band: "low" };
  let weighted = 0;
  let weights = 0;
  for (const factor of eligible) {
    const weight = Math.max(0.1, factor.confidence);
    weighted += factor.trust * weight;
    weights += weight;
  }
  const score = weights ? weighted / weights : 0;
  return {
    score: round(score, 3),
    band: score >= 0.78 ? "high" : score >= 0.62 ? "medium" : "low"
  };
}

function coverageSummary(ledger = {}, factors = [], eligible = []) {
  const configured = Math.max(
    factors.length,
    finite(ledger?.coverage?.configuredFamilies, 0),
    finite(ledger?.coverage?.totalFamilies, 0)
  );
  const eligibleFamilies = new Set(eligible.map((factor) => factor.key)).size;
  const sourceCount = new Set(eligible.flatMap((factor) => factor.sources.map((source) => source.provider)).filter(Boolean)).size;
  const ledgerRate = finite(ledger?.coverage?.coverageRate);
  const coverageRate = ledgerRate === null
    ? configured > 0 ? eligibleFamilies / configured : 0
    : clamp(ledgerRate, 0, 1);

  return {
    configuredFamilies: configured,
    eligibleFamilies,
    coverageRate: round(coverageRate, 3),
    sourceCount: Math.max(sourceCount, finite(ledger?.coverage?.sourceCount, 0)),
    independentOddsProviders: Math.max(0, finite(ledger?.coverage?.independentOddsProviders, 0))
  };
}

function dataQualityGate({ ledger, eligible, ignored, adverse, coverage, trust, conflicts, missing }) {
  const reasons = [];
  const odds = eligible.find((factor) => factor.key === "odds-consensus");
  const futureRejected = ignored.some((factor) => factor.chronology?.futureSourceCount > 0);

  if (!odds) reasons.push("eligible audited odds consensus is missing");
  if (coverage.coverageRate < 0.4) reasons.push("audited data-family coverage is below 40%");
  if (trust.score < MIN_AI_TRUST) reasons.push("eligible evidence trust is below the AI floor");
  if (conflicts.length) reasons.push("verified evidence conflicts remain unresolved");
  if (adverse.some((factor) => factor.downgradeEligible)) reasons.push("verified adverse evidence requires a downgrade");
  if (futureRejected) reasons.push("future-dated evidence was rejected by chronology guard");

  let decisionCeiling = "PLAY";
  if (!odds) decisionCeiling = "SKIP";
  else if (reasons.length) decisionCeiling = "CAUTION";

  return {
    safeForAi: eligible.length > 0 && !futureRejected,
    decisionCeiling,
    reasons: unique(reasons, 10),
    ignoredFactorCount: ignored.length,
    missingFactorCount: missing.length
  };
}

export function buildIntelligenceFusionV2(pick = {}, { now = Date.now() } = {}) {
  const ledger = pick.unifiedSportsData && typeof pick.unifiedSportsData === "object" ? pick.unifiedSportsData : {};
  const factors = (Array.isArray(ledger.factors) ? ledger.factors : []).map((factor) => compactFactor(factor, pick, now));
  const eligible = factors
    .filter((factor) => factor.eligibleForAi)
    .sort((left, right) => {
      const riskDelta = Number(right.downgradeEligible) - Number(left.downgradeEligible);
      if (riskDelta) return riskDelta;
      const impactDelta = Math.abs(right.impact) - Math.abs(left.impact);
      if (impactDelta) return impactDelta;
      return (right.confidence * right.trust) - (left.confidence * left.trust);
    });
  const ignored = factors.filter((factor) => !factor.eligibleForAi);
  const adverse = eligible.filter((factor) => factor.direction === "negative" || factor.direction === "risk" || factor.impact < -0.005);
  const missing = missingFromLedger(ledger);
  const conflicts = unique([
    ...(Array.isArray(pick.sportsIntelligence?.conflicts) ? pick.sportsIntelligence.conflicts : []),
    ...(Array.isArray(ledger.conflicts) ? ledger.conflicts : [])
  ].map((item) => typeof item === "string" ? item : item?.detail || item?.message), 8);
  const trust = trustSummary(eligible);
  const coverage = coverageSummary(ledger, factors, eligible);
  const gate = dataQualityGate({ ledger, eligible, ignored, adverse, coverage, trust, conflicts, missing });

  const explanationEvidence = unique(eligible.map(evidenceLine), MAX_ITEMS);
  const counterArguments = unique([
    ...adverse.map((factor) => `${factor.title} contains verified adverse evidence and may reduce decision quality.`),
    ...conflicts.map((conflict) => `Evidence conflict: ${conflict}`),
    ...ignored.slice(0, 3).map(ignoredLine),
    ...(coverage.coverageRate < 0.7 ? [`Only ${(coverage.coverageRate * 100).toFixed(0)}% of the audited data-family coverage is currently available.`] : [])
  ], MAX_ITEMS);
  const missingEvidence = unique([
    ...missing,
    ...ignored.filter((factor) => BAD_STATUSES.has(factor.status.toLowerCase())).map((factor) => `${factor.title} (${factor.status})`)
  ], MAX_ITEMS);

  return {
    version: "intelligence-fusion-v2",
    generatedAt: new Date(now).toISOString(),
    eventId: eventId(pick, ledger),
    selection: clean(pick.selection || pick.label || ledger.selection, 160) || null,
    coverage,
    trust,
    eligibleFactors: eligible.slice(0, 16),
    ignoredFactors: ignored.slice(0, 16),
    adverseFactors: adverse.slice(0, 10),
    conflicts,
    explanationEvidence,
    counterArguments,
    missingEvidence,
    dataQualityGate: gate,
    rules: {
      minimumConfidence: MIN_AI_CONFIDENCE,
      minimumTrust: MIN_AI_TRUST,
      chronologyGuard: true,
      missingDataImputed: false,
      contextCanUpgrade: false,
      contextCanDowngradeVerifiedRisk: true
    },
    probabilityAdjusted: false,
    marketProbabilityRemainsCanonical: true,
    paperOnly: true
  };
}

export function attachIntelligenceFusionV2(pick = {}, options = {}) {
  return {
    ...pick,
    intelligenceFusionV2: buildIntelligenceFusionV2(pick, options),
    probabilityAdjustedByIntelligenceFusion: false
  };
}

export const INTELLIGENCE_FUSION_V2_RULES = Object.freeze({
  minimumConfidence: MIN_AI_CONFIDENCE,
  minimumTrust: MIN_AI_TRUST,
  contextCanUpgrade: false,
  probabilityAdjusted: false,
  paperOnly: true
});
