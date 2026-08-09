import { fetchSportsGameOddsForMatch } from "./sportsgameodds-provider.js";
import { safeSportsGameOddsMatchDiagnostics } from "./sportsgameodds-match-v3.mjs";
import { safeSportsGameOddsUpstreamEvidence } from "./sportsgameodds-upstream-v1.mjs";

export const UNIFIED_CAPTURE_ENRICHMENT_VERSION = "scorecaster-unified-capture-enrichment-v2";
export const UNIFIED_CAPTURE_CONCURRENCY = 4;

const clean = (value, limit = 180) => String(value || "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const finite = (value) => value === null || value === undefined || value === ""
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;

const round = (value, digits = 4) => {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
};

function selectionSide(pick = {}) {
  const selection = clean(pick.selection || pick.label, 160).toLowerCase();
  const home = clean(pick.homeTeam, 160).toLowerCase();
  const away = clean(pick.awayTeam, 160).toLowerCase();
  if (selection && home && (selection === home || selection.includes(home) || home.includes(selection))) return "home";
  if (selection && away && (selection === away || selection.includes(away) || away.includes(selection))) return "away";
  return null;
}

function matchFromPick(pick = {}) {
  return {
    eventId: clean(pick.gameId || pick.eventId || pick.id, 180) || null,
    homeTeam: clean(pick.homeTeam, 140),
    awayTeam: clean(pick.awayTeam, 140),
    sportKey: clean(pick.sportKey || pick.league, 120),
    sport: clean(pick.sportTitle || pick.sportKey, 120),
    league: clean(pick.leagueTitle || pick.league, 140),
    commenceTime: pick.commenceTime || pick.commence_time || null
  };
}

function providerEvidence(secondaryOdds = {}) {
  const upstream = secondaryOdds.errorCategory
    ? safeSportsGameOddsUpstreamEvidence({
        status: secondaryOdds.status,
        errorCategory: secondaryOdds.errorCategory,
        retryAfterSeconds: secondaryOdds.retryAfterSeconds,
        attempts: secondaryOdds.attempts,
        retried: secondaryOdds.retried,
        usage: secondaryOdds.usage
      })
    : null;
  const rawConfidence = secondaryOdds.matchConfidence ?? secondaryOdds.data?.matchConfidence;
  const confidence = finite(rawConfidence);
  return {
    source: clean(secondaryOdds.source || "sportsgameodds", 100),
    mode: clean(secondaryOdds.mode || "unknown", 40),
    ok: secondaryOdds.ok === true,
    acquisition: "live-worker-capture",
    networkRequestMade: true,
    matchConfidence: confidence !== null && confidence >= 0 && confidence <= 1 ? round(confidence, 3) : null,
    matchDiagnostics: secondaryOdds.matchDiagnostics
      ? safeSportsGameOddsMatchDiagnostics(secondaryOdds.matchDiagnostics)
      : null,
    upstream,
    observedAt: secondaryOdds.retrievedAt || null
  };
}

function updatedOddsEvidence(current = [], values = {}) {
  const byLabel = new Map((Array.isArray(current) ? current : []).map((item) => [item?.label, item]));
  for (const [label, value] of Object.entries(values)) byLabel.set(label, { label, value });
  return [...byLabel.values()];
}

function mergeSecondaryIntoLedger(pick = {}, secondaryOdds = {}, now = Date.now()) {
  const current = pick.unifiedSportsData && typeof pick.unifiedSportsData === "object"
    ? pick.unifiedSportsData
    : null;
  if (!current) return null;

  const side = selectionSide(pick);
  const secondarySide = side ? secondaryOdds?.data?.[side] : null;
  const secondaryAverage = finite(secondarySide?.average);
  const primaryAverage = finite(pick.marketAverageOdds ?? pick.averageOdds ?? pick.consensusOdds);
  const liveSecondary = secondaryOdds?.mode === "live" && secondaryAverage !== null && secondaryAverage > 1;
  const providerCount = liveSecondary ? 2 : 1;
  const disagreement = liveSecondary && primaryAverage !== null && primaryAverage > 1
    ? Math.abs(primaryAverage - secondaryAverage) / ((primaryAverage + secondaryAverage) / 2)
    : null;

  const factors = Array.isArray(current.factors) ? current.factors.map((factor) => ({ ...factor })) : [];
  const oddsIndex = factors.findIndex((factor) => factor?.key === "odds-consensus");
  if (oddsIndex >= 0) {
    const existing = factors[oddsIndex] || {};
    const secondarySource = liveSecondary ? {
      id: "odds:secondary",
      name: "SportsGameOdds",
      provider: "sportsgameodds",
      type: "odds_market",
      trust: 0.82,
      observedAt: secondarySide?.latestAt || secondaryOdds.retrievedAt || new Date(now).toISOString(),
      mode: "live"
    } : null;
    const factorSources = Array.isArray(existing.sources) ? [...existing.sources] : [];
    if (secondarySource && !factorSources.some((source) => source?.provider === "sportsgameodds")) factorSources.push(secondarySource);
    factors[oddsIndex] = {
      ...existing,
      status: liveSecondary ? "verified-multi-provider" : existing.status,
      reason: liveSecondary
        ? `Capture evidence compared the primary market average with a second independent odds provider. Relative provider disagreement is ${disagreement === null ? "unknown" : `${(disagreement * 100).toFixed(1)}%`}. This capture-only enrichment does not change the public decision.`
        : existing.reason,
      evidence: updatedOddsEvidence(existing.evidence, {
        secondaryMarketAverage: secondaryAverage,
        independentOddsProviders: providerCount,
        providerDisagreement: disagreement === null ? null : round(disagreement, 4)
      }),
      sources: factorSources,
      missing: liveSecondary ? [] : existing.missing
    };
  }

  const sources = Array.isArray(current.sources) ? [...current.sources] : [];
  if (liveSecondary && !sources.some((source) => source?.provider === "sportsgameodds")) {
    sources.push({
      id: "odds:secondary",
      name: "SportsGameOdds",
      provider: "sportsgameodds",
      type: "odds_market",
      trust: 0.82,
      observedAt: secondarySide?.latestAt || secondaryOdds.retrievedAt || new Date(now).toISOString(),
      mode: "live"
    });
  }

  const missingData = Array.isArray(current.missingData)
    ? current.missingData.filter((item) => !(liveSecondary && item?.factor === "odds-consensus" && /secondary|independent/i.test(String(item?.missing || ""))))
    : [];

  return {
    ...current,
    generatedAt: new Date(now).toISOString(),
    policy: {
      ...(current.policy || {}),
      workerSecondaryPricingCaptureOnly: true,
      workerCaptureCanChangeDecision: false,
      workerCaptureCanChangeProbability: false
    },
    coverage: {
      ...(current.coverage || {}),
      sourceCount: sources.length,
      independentOddsProviders: providerCount
    },
    factors,
    sources,
    missingData,
    captureSecondaryPricing: {
      mode: liveSecondary ? "live" : clean(secondaryOdds?.mode || "unavailable", 40),
      provider: "sportsgameodds",
      independentOddsProviders: providerCount,
      providerDisagreement: disagreement === null ? null : round(disagreement, 4),
      evidenceOnly: true
    },
    paperOnly: true
  };
}

export async function enrichPickForUnifiedCapture(
  pick,
  {
    now = Date.now(),
    fetchSecondary = fetchSportsGameOddsForMatch
  } = {}
) {
  const beforeDecision = pick?.decision;
  const beforeProductDecision = pick?.productDecision;
  const beforeProbability = pick?.consensusProbability ?? pick?.modelProbability;
  const beforeStake = pick?.stake ?? pick?.recommendedStake ?? pick?.kellyStake;
  const beforeContextImpact = pick?.contextImpact;

  try {
    const secondaryOdds = await fetchSecondary(matchFromPick(pick));
    const ledger = mergeSecondaryIntoLedger(pick, secondaryOdds, now) || pick?.unifiedSportsData || null;
    return {
      ...pick,
      unifiedSportsData: ledger,
      unifiedDataProviders: {
        ...(pick?.unifiedDataProviders || {}),
        secondaryOdds: providerEvidence(secondaryOdds)
      },
      unifiedDataGeneratedAt: new Date(now).toISOString(),
      secondaryPricingAcquisition: "live-worker-capture",
      unifiedCaptureEnrichment: UNIFIED_CAPTURE_ENRICHMENT_VERSION,
      decision: beforeDecision,
      productDecision: beforeProductDecision,
      consensusProbability: pick?.consensusProbability,
      modelProbability: pick?.modelProbability,
      stake: pick?.stake,
      recommendedStake: pick?.recommendedStake,
      kellyStake: pick?.kellyStake,
      contextImpact: beforeContextImpact,
      captureInvariant: {
        decisionUnchanged: beforeDecision === pick?.decision,
        productDecisionUnchanged: beforeProductDecision === pick?.productDecision,
        probabilityUnchanged: beforeProbability === (pick?.consensusProbability ?? pick?.modelProbability),
        stakeUnchanged: beforeStake === (pick?.stake ?? pick?.recommendedStake ?? pick?.kellyStake),
        contextImpactUnchanged: beforeContextImpact === pick?.contextImpact
      }
    };
  } catch {
    return {
      ...pick,
      unifiedDataProviders: {
        ...(pick?.unifiedDataProviders || {}),
        secondaryOdds: {
          source: "sportsgameodds",
          mode: "fetch_error",
          ok: false,
          acquisition: "live-worker-capture",
          networkRequestMade: true,
          matchConfidence: null,
          matchDiagnostics: null,
          upstream: null
        }
      },
      unifiedDataGeneratedAt: new Date(now).toISOString(),
      secondaryPricingAcquisition: "worker-capture-failed-closed",
      unifiedCaptureEnrichment: UNIFIED_CAPTURE_ENRICHMENT_VERSION,
      captureInvariant: {
        decisionUnchanged: true,
        productDecisionUnchanged: true,
        probabilityUnchanged: true,
        stakeUnchanged: true,
        contextImpactUnchanged: true
      }
    };
  }
}

export async function enrichPicksForUnifiedCapture(
  picks = [],
  {
    now = Date.now(),
    concurrency = UNIFIED_CAPTURE_CONCURRENCY,
    enrichPick = enrichPickForUnifiedCapture
  } = {}
) {
  const rows = Array.isArray(picks) ? picks : [];
  const limit = Math.max(1, Math.min(8, Number.parseInt(String(concurrency), 10) || UNIFIED_CAPTURE_CONCURRENCY));
  const output = new Array(rows.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= rows.length) return;
      output[index] = await enrichPick(rows[index], { now });
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, () => worker()));
  return output;
}
