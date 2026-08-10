import { safeSportsGameOddsMatchDiagnostics } from "./sportsgameodds-match-v3.mjs";
import { safeSportsGameOddsUpstreamEvidence } from "./sportsgameodds-upstream-v1.mjs";

export const SECONDARY_PRICING_CAPTURE_MERGE_VERSION = "scorecaster-secondary-pricing-capture-merge-v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bounded(value, min = 0, max = 1, digits = 3) {
  const number = finite(value);
  if (number === null || number < min || number > max) return null;
  return Number(number.toFixed(digits));
}

function clean(value, limit = 180) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function selectionSide(pick = {}) {
  const selection = clean(pick.selection || pick.label, 160).toLowerCase();
  const home = clean(pick.homeTeam, 160).toLowerCase();
  const away = clean(pick.awayTeam, 160).toLowerCase();
  if (selection && home && (selection === home || selection.includes(home) || home.includes(selection))) return "home";
  if (selection && away && (selection === away || selection.includes(away) || away.includes(selection))) return "away";
  return null;
}

function replaceEvidence(evidence = [], label, value) {
  const rows = Array.isArray(evidence) ? evidence.filter((item) => item?.label !== label) : [];
  rows.push({ label, value });
  return rows;
}

function uniqueSources(sources = []) {
  const seen = new Set();
  const output = [];
  for (const source of Array.isArray(sources) ? sources : []) {
    const key = `${clean(source?.provider, 120)}:${clean(source?.id, 180)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(source);
  }
  return output;
}

export function buildSecondaryPricingCaptureTelemetry(secondary = {}) {
  const upstream = secondary?.errorCategory
    ? safeSportsGameOddsUpstreamEvidence({
        status: secondary.status,
        errorCategory: secondary.errorCategory,
        retryAfterSeconds: secondary.retryAfterSeconds,
        attempts: secondary.attempts,
        retried: secondary.retried,
        usage: secondary.usage
      })
    : null;

  return {
    source: "sportsgameodds",
    mode: clean(secondary?.mode || "unknown", 40),
    ok: secondary?.ok === true,
    acquisition: "live-worker-capture",
    networkRequestMade: true,
    matchConfidence: bounded(secondary?.matchConfidence ?? secondary?.data?.matchConfidence),
    matchDiagnostics: secondary?.matchDiagnostics
      ? safeSportsGameOddsMatchDiagnostics(secondary.matchDiagnostics)
      : null,
    upstream,
    observedAt: secondary?.retrievedAt || null
  };
}

export function mergeSecondaryPricingIntoCaptureLedger(pick = {}, secondary = {}, { now = Date.now() } = {}) {
  const baseLedger = pick?.unifiedSportsData && typeof pick.unifiedSportsData === "object"
    ? pick.unifiedSportsData
    : {};
  const factors = Array.isArray(baseLedger.factors) ? baseLedger.factors.map((item) => ({ ...item })) : [];
  const oddsIndex = factors.findIndex((item) => item?.key === "odds-consensus");
  const side = selectionSide(pick);
  const secondarySide = secondary?.mode === "live" && side ? secondary?.data?.[side] : null;
  const secondaryAverage = finite(secondarySide?.average);
  const primaryAverage = finite(pick.marketAverageOdds ?? pick.averageOdds ?? pick.consensusOdds ?? pick.odds);
  const hasSecondary = secondary?.mode === "live" && secondaryAverage !== null && secondaryAverage > 1;
  const providerCount = hasSecondary ? 2 : 1;
  const disagreement = hasSecondary && primaryAverage !== null && primaryAverage > 1
    ? Math.abs(primaryAverage - secondaryAverage) / ((primaryAverage + secondaryAverage) / 2)
    : null;

  if (oddsIndex >= 0) {
    const current = factors[oddsIndex];
    let evidence = replaceEvidence(current.evidence, "secondaryMarketAverage", hasSecondary ? secondaryAverage : null);
    evidence = replaceEvidence(evidence, "independentOddsProviders", providerCount);
    evidence = replaceEvidence(evidence, "providerDisagreement", disagreement === null ? null : Number(disagreement.toFixed(4)));
    const missing = Array.isArray(current.missing)
      ? current.missing.filter((item) => item !== "independent secondary odds provider match")
      : [];
    if (!hasSecondary) missing.push("independent secondary odds provider match");

    const factorSources = Array.isArray(current.sources) ? [...current.sources] : [];
    if (hasSecondary) {
      factorSources.push({
        id: "odds:secondary",
        name: "SportsGameOdds",
        provider: "sportsgameodds",
        type: "odds_market",
        trust: 0.82,
        observedAt: secondarySide?.latestAt || secondary?.retrievedAt || new Date(now).toISOString(),
        mode: "live"
      });
    }

    factors[oddsIndex] = {
      ...current,
      status: hasSecondary ? "verified-multi-provider" : current.status,
      evidence,
      sources: uniqueSources(factorSources),
      missing: [...new Set(missing)]
    };
  }

  const ledgerSources = [...(Array.isArray(baseLedger.sources) ? baseLedger.sources : [])];
  if (hasSecondary) {
    ledgerSources.push({
      id: "odds:secondary",
      name: "SportsGameOdds",
      provider: "sportsgameodds",
      type: "odds_market",
      trust: 0.82,
      observedAt: secondarySide?.latestAt || secondary?.retrievedAt || new Date(now).toISOString(),
      mode: "live"
    });
  }
  const sources = uniqueSources(ledgerSources);
  const coverage = {
    ...(baseLedger.coverage || {}),
    sourceCount: sources.length,
    independentOddsProviders: providerCount
  };

  const ledger = {
    ...baseLedger,
    factors,
    sources,
    coverage,
    captureEvidence: {
      version: SECONDARY_PRICING_CAPTURE_MERGE_VERSION,
      secondaryPricingAcquisition: "worker-only",
      secondaryProviderMode: clean(secondary?.mode || "unknown", 40),
      secondaryMatched: hasSecondary,
      probabilityChanged: false,
      decisionChanged: false,
      stakeChanged: false,
      contextImpactChanged: false
    }
  };

  return {
    ledger,
    providerTelemetry: buildSecondaryPricingCaptureTelemetry(secondary),
    secondaryMatched: hasSecondary,
    providerCount,
    disagreement: disagreement === null ? null : Number(disagreement.toFixed(4)),
    safety: {
      probabilityChanged: false,
      decisionChanged: false,
      stakeChanged: false,
      contextImpactChanged: false,
      paperOnly: true
    }
  };
}
