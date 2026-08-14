import { buildUnifiedSportsDataLedger } from "./unified-sports-data-v1.mjs";
import { calculatePregameEvidenceCoverage, failClosedPregameEvidenceFactors } from "./pregame-evidence-coverage-v1.mjs";

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

function secondaryProviderIdentity(secondaryOdds = {}) {
  const source = String(secondaryOdds?.source || "sportsgameodds").trim().toLowerCase();
  if (source === "sportsdata") {
    return {
      source,
      provider: "sportsdataio",
      name: "SportsDataIO betting feed"
    };
  }
  return {
    source,
    provider: source || "sportsgameodds",
    name: source === "sportsgameodds" ? "SportsGameOdds" : String(secondaryOdds?.source || "Secondary odds provider")
  };
}

function preserveSecondaryProviderProvenance(replacement, secondaryOdds = {}) {
  if (!replacement || secondaryOdds?.mode !== "live") return replacement;
  const identity = secondaryProviderIdentity(secondaryOdds);
  const sources = (Array.isArray(replacement.sources) ? replacement.sources : []).map((source) => {
    if (source?.id !== "odds:secondary") return source;
    return {
      ...source,
      name: identity.name,
      provider: identity.provider
    };
  });
  const evidence = [
    ...(Array.isArray(replacement.evidence) ? replacement.evidence : []).filter((item) => item?.label !== "secondaryProviderFamily"),
    { label: "secondaryProviderFamily", value: identity.provider }
  ];
  return { ...replacement, sources, evidence };
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
  const guardedFactors = failClosedPregameEvidenceFactors(factors);
  const configuredFamilies = guardedFactors.filter((factor) => !CONFIGURED_EXCLUSIONS.has(String(factor?.status || ""))).length;
  const usedFamilies = guardedFactors.filter((factor) => factor?.usedByAi === true && factor?.useMode !== "training-and-calibration-only").length;
  const coverageRate = guardedFactors.length ? configuredFamilies / guardedFactors.length : 0;
  const pregame = calculatePregameEvidenceCoverage(guardedFactors);
  return {
    ...baseCoverage,
    totalFamilies: guardedFactors.length,
    configuredFamilies,
    usedFamilies,
    coverageRate: round(coverageRate, 3),
    verifiedCoverageRate: round(pregame.applicableVerifiedCoverageRate, 3),
    pregameCoverageRate: round(pregame.applicableCoverageRate, 3),
    applicablePregameFamilies: pregame.applicablePregameFamilies,
    configuredPregameFamilies: pregame.configuredPregameFamilies,
    usedPregameFamilies: pregame.usedPregameFamilies,
    verifiedPregameFamilies: pregame.verifiedPregameFamilies,
    pregameCoverageVersion: pregame.version,
    pregameExcludedFamilies: pregame.excludedFamilies,
    syntheticZeroRestRejected: pregame.syntheticZeroRestRejected,
    missingEvidenceStillCounts: true,
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
  const rawReplacement = oddsFactor(secondaryLedger);
  const replacement = preserveSecondaryProviderProvenance(rawReplacement, secondaryOdds);
  if (!replacement) {
    return {
      ledger: baseLedger,
      merged: false,
      reason: "secondary-odds-factor-unavailable"
    };
  }

  let replaced = false;
  const replacedFactors = baseLedger.factors.map((factor) => {
    if (factor?.key !== "odds-consensus") return factor;
    replaced = true;
    return replacement;
  });
  if (!replaced) replacedFactors.unshift(replacement);
  const factors = failClosedPregameEvidenceFactors(replacedFactors);

  const sources = uniqueSources(factors);
  const providerCount = independentProviderCount(replacement);
  const identity = secondaryProviderIdentity(secondaryOdds);
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
        secondaryProviderFamily: secondaryOdds?.mode === "live" ? identity.provider : null,
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
