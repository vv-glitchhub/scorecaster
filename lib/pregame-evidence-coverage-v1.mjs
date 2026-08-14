export const PREGAME_EVIDENCE_COVERAGE_VERSION = "scorecaster-pregame-evidence-coverage-v1";

const CONFIGURED_EXCLUSIONS = new Set([
  "not-configured",
  "missing",
  "not-verified",
  "not-confirmed",
  "no-reliable-news",
  "not-yet-available"
]);

function round(value, digits = 3) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : 0;
}

function statusOf(factor = {}) {
  return String(factor?.status || "").trim().toLowerCase();
}

function evidenceRows(factor = {}) {
  return Array.isArray(factor?.evidence) ? factor.evidence : [];
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formHasNoVerifiedHistory(formFactor = {}) {
  if (String(formFactor?.key || "") !== "recent-form") return false;
  if (statusOf(formFactor) !== "insufficient-sample") return false;
  const rows = evidenceRows(formFactor);
  if (!rows.length) return true;
  const samples = rows
    .map((row) => finiteOrNull(row?.sampleSize))
    .filter((value) => value !== null);
  return samples.length === 0 || Math.max(...samples) <= 0;
}

function restLooksSyntheticZero(restFactor = {}) {
  if (String(restFactor?.key || "") !== "rest-and-congestion") return false;
  if (statusOf(restFactor) !== "ready") return false;
  const row = evidenceRows(restFactor)[0] || {};
  const selectedRest = finiteOrNull(row?.selectedRestHours);
  const opponentRest = finiteOrNull(row?.opponentRestHours);
  return selectedRest === 0 && opponentRest === 0;
}

export function failClosedPregameEvidenceFactors(factors = []) {
  const rows = Array.isArray(factors) ? factors : [];
  const formFactor = rows.find((factor) => factor?.key === "recent-form") || null;
  const suppressSyntheticRest = formFactor && formHasNoVerifiedHistory(formFactor);

  if (!suppressSyntheticRest) return rows;
  return rows.map((factor) => {
    if (!restLooksSyntheticZero(factor)) return factor;
    return {
      ...factor,
      status: "missing",
      confidence: 0,
      impact: 0,
      usedByAi: false,
      downgradeEligible: false,
      direction: "neutral",
      reason: "Rest comparison is unavailable because no completed pregame result timestamp was verified for the matchup.",
      evidence: [],
      missing: ["verified previous-game timestamps for both teams"],
      evidenceGuard: "synthetic-zero-rest-rejected"
    };
  });
}

export function factorIsPregameApplicable(factor = {}) {
  if (factor?.useMode === "training-and-calibration-only") return false;
  const status = statusOf(factor);
  if (status === "not-applicable" || status.startsWith("not_applicable")) return false;
  return true;
}

export function calculatePregameEvidenceCoverage(factors = []) {
  const rows = failClosedPregameEvidenceFactors(factors);
  const applicable = rows.filter(factorIsPregameApplicable);
  const configured = applicable.filter((factor) => !CONFIGURED_EXCLUSIONS.has(statusOf(factor)));
  const used = applicable.filter((factor) => factor?.usedByAi === true);
  const verified = applicable.filter((factor) => Number(factor?.confidence) >= 0.65 && Number(factor?.trust) >= 0.7);
  const denominator = applicable.length;

  return {
    version: PREGAME_EVIDENCE_COVERAGE_VERSION,
    totalFamilies: rows.length,
    applicablePregameFamilies: denominator,
    configuredPregameFamilies: configured.length,
    usedPregameFamilies: used.length,
    verifiedPregameFamilies: verified.length,
    applicableCoverageRate: denominator ? round(configured.length / denominator) : 0,
    applicableVerifiedCoverageRate: denominator ? round(verified.length / denominator) : 0,
    excludedFamilies: rows
      .filter((factor) => !factorIsPregameApplicable(factor))
      .map((factor) => String(factor?.key || "unknown")).slice(0, 20),
    syntheticZeroRestRejected: rows.some((factor) => factor?.evidenceGuard === "synthetic-zero-rest-rejected"),
    missingEvidenceStillCounts: true,
    probabilityChanged: false,
    thresholdsChanged: false,
    paperOnly: true
  };
}

export function applyPregameEvidenceCoverage(ledger = {}) {
  if (!ledger || typeof ledger !== "object") return ledger;
  const factors = failClosedPregameEvidenceFactors(Array.isArray(ledger.factors) ? ledger.factors : []);
  const result = calculatePregameEvidenceCoverage(factors);
  return {
    ...ledger,
    factors,
    coverage: {
      ...(ledger.coverage || {}),
      applicablePregameFamilies: result.applicablePregameFamilies,
      configuredPregameFamilies: result.configuredPregameFamilies,
      usedPregameFamilies: result.usedPregameFamilies,
      verifiedPregameFamilies: result.verifiedPregameFamilies,
      verifiedCoverageRate: result.applicableVerifiedCoverageRate,
      pregameCoverageRate: result.applicableCoverageRate,
      pregameCoverageVersion: result.version,
      pregameExcludedFamilies: result.excludedFamilies,
      syntheticZeroRestRejected: result.syntheticZeroRestRejected,
      missingEvidenceStillCounts: true
    }
  };
}
