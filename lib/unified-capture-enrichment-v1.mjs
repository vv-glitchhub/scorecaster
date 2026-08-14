import { fetchVerifiedSecondaryOddsForMatch } from "./secondary-odds-provider-chain-v1.mjs";
import { safeSportsGameOddsMatchDiagnostics } from "./sportsgameodds-match-v3.mjs";
import { safeSportsGameOddsUpstreamEvidence } from "./sportsgameodds-upstream-v1.mjs";
import { mergeSecondaryPricingIntoCaptureLedger } from "./unified-capture-ledger-merge-v1.mjs";

export const UNIFIED_CAPTURE_ENRICHMENT_VERSION = "scorecaster-unified-capture-enrichment-v1";
export const UNIFIED_CAPTURE_CONCURRENCY = 4;

function boundedConfidence(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) return null;
  return Number(number.toFixed(3));
}

function clean(value, limit = 180) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
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

function safeProviderAttempts(attempts = []) {
  return (Array.isArray(attempts) ? attempts : []).slice(0, 4).map((attempt) => ({
    source: clean(attempt?.source, 60) || "unknown",
    mode: clean(attempt?.mode, 60) || "unavailable",
    status: Number.isFinite(Number(attempt?.status)) ? Number(attempt.status) : null,
    quotaPreflightBlocked: attempt?.quotaPreflightBlocked === true,
    subscriptionUnavailable: attempt?.subscriptionUnavailable === true,
    eventRequestMade: attempt?.eventRequestMade === true,
    usageRequestMade: attempt?.usageRequestMade === true,
    bindingLimits: (Array.isArray(attempt?.bindingLimits) ? attempt.bindingLimits : []).map((item) => clean(item, 100)).filter(Boolean).slice(0, 8),
    matchConfidence: boundedConfidence(attempt?.matchConfidence)
  }));
}

function safeSecondaryProvider(secondaryOdds = {}) {
  const source = clean(secondaryOdds?.source || "sportsgameodds", 60);
  const fallbackBindingLimits = Array.isArray(secondaryOdds?.fallbackFrom?.bindingLimits)
    ? secondaryOdds.fallbackFrom.bindingLimits.map((item) => clean(item, 100)).filter(Boolean).slice(0, 8)
    : [];
  const upstream = secondaryOdds?.errorCategory
    ? safeSportsGameOddsUpstreamEvidence({
        status: secondaryOdds.status,
        errorCategory: secondaryOdds.errorCategory,
        retryAfterSeconds: secondaryOdds.retryAfterSeconds,
        attempts: secondaryOdds.attempts,
        retried: secondaryOdds.retried,
        usage: secondaryOdds.usage
      })
    : fallbackBindingLimits.length
      ? {
          status: secondaryOdds?.fallbackFrom?.status || null,
          errorCategory: "quota_preflight_blocked",
          retryAfterSeconds: null,
          attempts: 0,
          retried: false,
          usage: { bindingLimits: fallbackBindingLimits }
        }
      : null;
  const usageRequestMade = secondaryOdds?.usageRequestMade === true;
  const eventRequestMade = secondaryOdds?.eventRequestMade === true;
  return {
    source,
    providerFamily: clean(secondaryOdds?.providerFamily || (source === "sportsdata" ? "sportsdataio" : source), 80),
    mode: secondaryOdds?.mode || "unavailable",
    ok: secondaryOdds?.ok === true,
    acquisition: "live-worker-capture",
    networkRequestMade: eventRequestMade,
    usageRequestMade,
    eventRequestMade,
    quotaPreflightBlocked: secondaryOdds?.quotaPreflightBlocked === true,
    subscriptionUnavailable: secondaryOdds?.subscriptionUnavailable === true,
    retrievedAt: secondaryOdds?.retrievedAt || null,
    matchConfidence: boundedConfidence(secondaryOdds?.matchConfidence ?? secondaryOdds?.data?.matchConfidence),
    matchDiagnostics: source === "sportsgameodds" && secondaryOdds?.matchDiagnostics
      ? safeSportsGameOddsMatchDiagnostics(secondaryOdds.matchDiagnostics)
      : null,
    providerChainVersion: clean(secondaryOdds?.providerChainVersion, 100) || null,
    providerAttempts: safeProviderAttempts(secondaryOdds?.providerAttempts),
    fallbackUsed: secondaryOdds?.fallbackUsed === true,
    fallbackReason: clean(secondaryOdds?.fallbackReason, 80) || null,
    fallbackAttempted: secondaryOdds?.fallbackAttempted === true || secondaryOdds?.fallbackUsed === true,
    fallbackMode: clean(secondaryOdds?.fallbackMode, 80) || null,
    fallbackSubscriptionUnavailable: secondaryOdds?.fallbackSubscriptionUnavailable === true,
    upstream
  };
}

export async function enrichPickForUnifiedCapture(
  pick,
  {
    now = Date.now(),
    fetchSecondary = fetchVerifiedSecondaryOddsForMatch
  } = {}
) {
  try {
    const secondaryOdds = await fetchSecondary(matchFromPick(pick), { preflightUsage: true });
    const merged = mergeSecondaryPricingIntoCaptureLedger({
      pick,
      baseLedger: pick?.unifiedSportsData,
      secondaryOdds,
      now
    });
    if (!merged.ledger) {
      return {
        ...pick,
        secondaryPricingAcquisition: "worker-capture-failed-closed",
        unifiedCaptureEnrichment: UNIFIED_CAPTURE_ENRICHMENT_VERSION
      };
    }
    return {
      ...pick,
      unifiedSportsData: merged.ledger,
      unifiedDataProviders: {
        ...(pick?.unifiedDataProviders || {}),
        secondaryOdds: safeSecondaryProvider(secondaryOdds)
      },
      unifiedDataCached: false,
      unifiedDataGeneratedAt: new Date(now).toISOString(),
      secondaryPricingAcquisition: "live-worker-capture",
      unifiedCaptureEnrichment: UNIFIED_CAPTURE_ENRICHMENT_VERSION,
      unifiedCaptureLedgerMerged: merged.merged,
      unifiedCaptureLedgerReason: merged.reason
    };
  } catch {
    return {
      ...pick,
      secondaryPricingAcquisition: "worker-capture-failed-closed",
      unifiedCaptureEnrichment: UNIFIED_CAPTURE_ENRICHMENT_VERSION
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
