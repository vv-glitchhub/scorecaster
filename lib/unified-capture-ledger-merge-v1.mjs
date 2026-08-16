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

function marketMovementFactor(ledger = {}) {
  return (Array.isArray(ledger?.factors) ? ledger.factors : []).find((factor) => factor?.key === "market-movement") || null;
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

function verifiedMarketMovementFactor(baseFactor = {}, marketHistory = {}) {
  const snapshotCount = Math.max(0, Math.min(160, Number(marketHistory.snapshotCount) || 0));
  const spanMinutes = Math.max(0, Number(marketHistory.spanMinutes) || 0);
  const confidence = Math.min(0.82, Number((0.62 + Math.min(snapshotCount, 20) * 0.006 + Math.min(spanMinutes, 1440) / 1440 * 0.08).toFixed(3)));
  return {
    ...baseFactor,
    key: "market-movement",
    title: baseFactor?.title || "Market movement",
    status: "ready",
    confidence,
    trust: 0.8,
    impact: 0,
    direction: "neutral",
    useMode: baseFactor?.useMode || "explanation-and-risk",
    usedByAi: true,
    downgradeEligible: false,
    sources: [{
      id: "market-history:scorecaster",
      name: "Scorecaster verified pregame market history",
      provider: "scorecaster-market-history",
      sourceType: "first_party_verified_history",
      trust: 0.8,
      observedAt: marketHistory.latestHistoricalCapturedAt || null
    }],
    evidence: [
      { label: "openingOdds", value: marketHistory.openingOdds },
      { label: "currentOdds", value: marketHistory.currentOdds },
      { label: "movementPct", value: marketHistory.movementPct },
      { label: "snapshotCount", value: snapshotCount },
      { label: "historySpanMinutes", value: round(spanMinutes, 2) },
      { label: "openingCapturedAt", value: marketHistory.openingCapturedAt || null },
      { label: "latestHistoricalCapturedAt", value: marketHistory.latestHistoricalCapturedAt || null },
      { label: "chronologySafe", value: marketHistory.chronologySafe === true }
    ],
    missing: []
  };
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

function missingDataFromFactors(factors = []) {
  return factors.flatMap((factor) => (Array.isArray(factor?.missing) ? factor.missing : [])
    .map((missing) => ({ factor: factor?.key, missing })));
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

  return {
    merged: true,
    reason: providerCount >= 2 ? "secondary-pricing-verified" : "secondary-pricing-not-live",
    ledger: {
      ...baseLedger,
      generatedAt: new Date(now).toISOString(),
      factors,
      sources,
      coverage: coverageFromFactors(baseLedger.coverage || {}, factors, sources, providerCount),
      missingData: missingDataFromFactors(factors),
      captureEvidence: {
        ...(baseLedger.captureEvidence || {}),
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

export function mergeMarketHistoryIntoCaptureLedger({
  pick = {},
  baseLedger = null,
  marketHistory = null,
  now = Date.now()
} = {}) {
  if (!baseLedger || !Array.isArray(baseLedger.factors) || !baseLedger.factors.length) {
    return { ledger: baseLedger || null, merged: false, reason: "base-ledger-unavailable" };
  }
  if (marketHistory?.mode !== "live" || marketHistory?.chronologySafe !== true) {
    return { ledger: baseLedger, merged: false, reason: marketHistory?.mode || "market-history-unavailable" };
  }

  const candidateLedger = buildUnifiedSportsDataLedger({
    pick: {
      ...pick,
      openingOdds: marketHistory.openingOdds,
      currentOdds: marketHistory.currentOdds,
      odds: marketHistory.currentOdds
    },
    now
  });
  const candidate = marketMovementFactor(candidateLedger);
  const baseFactor = marketMovementFactor(baseLedger);
  const replacement = verifiedMarketMovementFactor(candidate || baseFactor || {}, marketHistory);

  let replaced = false;
  const replacedFactors = baseLedger.factors.map((factor) => {
    if (factor?.key !== "market-movement") return factor;
    replaced = true;
    return replacement;
  });
  if (!replaced) replacedFactors.push(replacement);
  const factors = failClosedPregameEvidenceFactors(replacedFactors);
  const sources = uniqueSources(factors);
  const providerCount = Number(baseLedger.coverage?.independentOddsProviders) || 1;

  return {
    merged: true,
    reason: "verified-first-party-market-history",
    ledger: {
      ...baseLedger,
      generatedAt: new Date(now).toISOString(),
      factors,
      sources,
      coverage: coverageFromFactors(baseLedger.coverage || {}, factors, sources, providerCount),
      missingData: missingDataFromFactors(factors),
      captureEvidence: {
        ...(baseLedger.captureEvidence || {}),
        version: UNIFIED_CAPTURE_LEDGER_MERGE_VERSION,
        marketHistoryMerged: true,
        marketHistorySource: "scorecaster-market-history",
        marketHistorySnapshotCount: marketHistory.snapshotCount,
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
