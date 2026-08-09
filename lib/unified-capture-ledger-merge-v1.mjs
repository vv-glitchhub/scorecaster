import { buildUnifiedSportsDataLedger } from "./unified-sports-data-v1.mjs";

export const UNIFIED_CAPTURE_LEDGER_MERGE_VERSION = "scorecaster-unified-capture-ledger-merge-v1";

const CONFIGURED_EXCLUSIONS = new Set([
  "not-configured",
  "missing",
  "not-verified",
  "not-confirmed",
  "no-reliable-news",
  "not-yet-available"
]);

function round(value, digits = 4) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function oddsFactor(ledger = {}) {
  return (Array.isArray(ledger?.factors) ? ledger.factors : []).find((factor) => factor?.key === "odds-consensus") || null;
}

function independentProviderCount(factor) {
  const evidence = Array.isArray(factor?.evidence) ? factor.evidence : [];
  const value = Number(evidence.find((item) => item?.label === "independentOddsProviders")?.value);
  return Number.isFinite(value) && value >= 1 ? Math.min(10, Math.round(value)) : 1;
}

function uniqueSources(factors = []) {
  const rows = [];
  const seen = new Set();
  for (const source of factors.flatMap((factor) => Array.isArray(factor?.sources) ? factor.sources : [])) {
    const key = `${String(source?.provider || "")}:${String(source?.id || "")}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(source);
  }
  return rows;
}

function coverageFromFactors(baseCoverage = {}, factors = [], sources = [], providerCount = 1) {
  const configuredFamilies = factors.filter((factor) => !CONFIGURED_EXCLUSIONS.has(String(factor?.status || ""))).length;
  const usedFamilies = factors.filter((factor) => factor?.usedByAi === true && factor?.useMode !== "training-and-calibration-only").length;
  const coverageRate = factors.length ? configuredFamilies / factors.length : 0;
  const verifiedCoverageRate = factors.length
    ? factors.filter((factor) => Number(factor?.confidence) >= 0.65 && Number(factor?.trust) >= 0.7).length / factors.length
    : 0;
  return {
    ...baseCoverage,
    totalFamilies: factors.length,
    configuredFamilies,
    usedFamilies,
    coverageRate: round(coverageRate, 3),
    verifiedCoverageRate: round(verifiedCoverageRate, 3),
    sourceCount: sources.length,
    independentOddsProviders: providerCount
  };
}

export function mergeSecondaryPricingIntoCaptureLedger({
  pick = {},
  baseLedger = null,
  secondaryOdds = null,
  now = Date.now()
} = {}) {
  if (!baseLedger || !Array.isArray(baseLedger.factors) || !baseLedger.factors.length) {
    return {
      ledger: baseLedger || null,
      merged: false,
      reason: "base-ledger-unavailable"
    };
  }

  const secondaryLedger = buildUnifiedSportsDataLedger({ pick, secondaryOdds, now });
  const replacement = oddsFactor(secondaryLedger);
  if (!replacement) {
    return {
      ledger: baseLedger,
      merged: false,
      reason: "secondary-odds-factor-unavailable"
    };
  }

  let replaced = false;
  const factors = baseLedger.factors.map((factor) => {
    if (factor?.key !== "odds-consensus") return factor;
    replaced = true;
    return replacement;
  });
  if (!replaced) factors.unshift(replacement);

  const sources = uniqueSources(factors);
  const providerCount = independentProviderCount(replacement);
  const missingData = factors.flatMap((factor) => (Array.isArray(factor?.missing) ? factor.missing : [])
    .map((missing) => ({ factor: factor?.key, missing })));

  return {
    merged: true,
    reason: providerCount >= 2 ? "secondary-pricing-verified" : "secondary-pricing-not-live",
    ledger: {
      ...baseLedger,
      generatedAt: new Date(now).toISOString(),
      factors,
      sources,
      coverage: coverageFromFactors(baseLedger.coverage || {}, factors, sources, providerCount),
      missingData,
      captureEvidence: {
        version: UNIFIED_CAPTURE_LEDGER_MERGE_VERSION,
        secondaryPricingMerged: true,
        independentOddsProviders: providerCount,
        probabilityChanged: false,
        decisionChanged: false,
        stakeChanged: false,
        contextImpactChanged: false,
        publicExplanationRewritten: false,
        paperOnly: true
      }
    }
  };
}
