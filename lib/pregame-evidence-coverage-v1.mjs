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

export function factorIsPregameApplicable(factor = {}) {
  if (factor?.useMode === "training-and-calibration-only") return false;
  const status = statusOf(factor);
  if (status === "not-applicable" || status.startsWith("not_applicable")) return false;
  return true;
}

export function calculatePregameEvidenceCoverage(factors = []) {
  const rows = Array.isArray(factors) ? factors : [];
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
    missingEvidenceStillCounts: true,
    probabilityChanged: false,
    thresholdsChanged: false,
    paperOnly: true
  };
}

export function applyPregameEvidenceCoverage(ledger = {}) {
  if (!ledger || typeof ledger !== "object") return ledger;
  const factors = Array.isArray(ledger.factors) ? ledger.factors : [];
  const result = calculatePregameEvidenceCoverage(factors);
  return {
    ...ledger,
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
      missingEvidenceStillCounts: true
    }
  };
}
