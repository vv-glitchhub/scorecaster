// Research review rules, not statistically established production thresholds.
// Changing these rules requires a new version; past samples are exploratory.
export const VALIDATION_REVIEW_POLICY = Object.freeze({
  version: "scorecaster-validation-review-v1",
  status: "research-review-policy",
  provisionalSample: 30,
  minimumPairedEvents: 100,
  minimumCompleteMonths: 3,
  minimumEventsPerMonth: 25,
  requiredPairedCoverage: 1,
  automaticPromotionAllowed: false
});

export function validationNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatValidationMetric(value, { percent = false, digits = 4 } = {}) {
  const number = validationNumber(value);
  return number === null ? "—" : `${(number * (percent ? 100 : 1)).toFixed(digits)}${percent ? "%" : ""}`;
}

function mean(rows, key) {
  return rows.length ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length : null;
}

function comparison(rows) {
  const modelBrier = mean(rows, "brier");
  const marketBrier = mean(rows, "marketBrier");
  const modelLogLoss = mean(rows, "logLoss");
  const marketLogLoss = mean(rows, "marketLogLoss");
  return {
    sampleSize: rows.length,
    modelBrier,
    marketBrier,
    brierImprovement: rows.length ? marketBrier - modelBrier : null,
    logLossImprovement: rows.length ? marketLogLoss - modelLogLoss : null
  };
}

export function buildModelValidationEvidence(rows = [], { now = Date.now() } = {}) {
  const policy = VALIDATION_REVIEW_POLICY;
  const paired = rows.filter((row) => ["brier", "marketBrier", "logLoss", "marketLogLoss"]
    .every((key) => typeof row[key] === "number" && Number.isFinite(row[key]) && row[key] >= 0));
  const groups = new Map();
  for (const row of paired) {
    const month = row.commenceTime.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(row);
  }
  const currentMonth = new Date(now).toISOString().slice(0, 7);
  const periods = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({
    month,
    complete: month < currentMonth,
    ...comparison(values)
  }));
  const completePeriods = periods.filter((period) => period.complete && period.sampleSize >= policy.minimumEventsPerMonth);
  const positivePeriods = completePeriods.filter((period) => period.brierImprovement > 0 && period.logLossImprovement > 0);
  const overall = comparison(paired);
  const coverage = rows.length ? paired.length / rows.length : null;
  const checks = [
    { id: "paired-sample", passed: paired.length >= policy.minimumPairedEvents, current: paired.length, target: policy.minimumPairedEvents },
    { id: "paired-coverage", passed: coverage === policy.requiredPairedCoverage, current: coverage, target: policy.requiredPairedCoverage },
    { id: "brier-improvement", passed: overall.brierImprovement !== null && overall.brierImprovement > 0, current: overall.brierImprovement, target: 0 },
    { id: "log-loss-improvement", passed: overall.logLossImprovement !== null && overall.logLossImprovement > 0, current: overall.logLossImprovement, target: 0 },
    { id: "repeatability", passed: completePeriods.length >= policy.minimumCompleteMonths && positivePeriods.length === completePeriods.length, current: positivePeriods.length, target: policy.minimumCompleteMonths }
  ];
  return {
    version: policy.version,
    scope: "independent-shadow-model-research",
    stage: checks.every((check) => check.passed) ? "research-review" : "early-stage",
    checks,
    pairedEvents: paired.length,
    settledEvents: rows.length,
    pairedCoverage: coverage,
    periods,
    completePeriods: completePeriods.length,
    // These retrospective checks cannot establish prospective model skill.
    prospectiveProtocolVerified: false,
    trainingProvenanceVerified: false,
    productionReady: false,
    automaticPromotionAllowed: false
  };
}
