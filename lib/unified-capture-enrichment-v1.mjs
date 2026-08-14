import { fetchSportsGameOddsForMatch } from "./sportsgameodds-provider.js";
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

function safeSecondaryProvider(secondaryOdds = {}) {
  const upstream = secondaryOdds?.errorCategory
    ? safeSportsGameOddsUpstreamEvidence({
        status: secondaryOdds.status,
        errorCategory: secondaryOdds.errorCategory,
        retryAfterSeconds: secondaryOdds.retryAfterSeconds,
        attempts: secondaryOdds.attempts,
        retried: secondaryOdds.retried,
        usage: secondaryOdds.usage
      })
    : null;
  const usageRequestMade = secondaryOdds?.usageRequestMade === true;
  const eventRequestMade = secondaryOdds?.eventRequestMade === true;
  return {
    source: secondaryOdds?.source || "sportsgameodds",
    mode: secondaryOdds?.mode || "unavailable",
    ok: secondaryOdds?.ok === true,
    acquisition: "live-worker-capture",
    networkRequestMade: usageRequestMade || eventRequestMade,
    usageRequestMade,
    eventRequestMade,
    quotaPreflightBlocked: secondaryOdds?.quotaPreflightBlocked === true,
    retrievedAt: secondaryOdds?.retrievedAt || null,
    matchConfidence: boundedConfidence(secondaryOdds?.matchConfidence ?? secondaryOdds?.data?.matchConfidence),
    matchDiagnostics: secondaryOdds?.matchDiagnostics
      ? safeSportsGameOddsMatchDiagnostics(secondaryOdds.matchDiagnostics)
      : null,
    upstream
  };
}

export function summarizeUnifiedCaptureSecondaryPricing(picks = []) {
  const allPicks = Array.isArray(picks) ? picks : [];
  const rows = allPicks
    .map((pick) => pick?.unifiedDataProviders?.secondaryOdds)
    .filter(Boolean);
  const bindingLimits = [...new Set(rows.flatMap((provider) => Array.isArray(provider?.upstream?.usage?.bindingLimits)
    ? provider.upstream.usage.bindingLimits
    : []))].slice(0, 10);
  const quotaBlocked = rows.filter((provider) => provider?.quotaPreflightBlocked === true).length;
  const unsupported = rows.filter((provider) => provider?.mode === "unsupported_league").length;
  const notConfigured = rows.filter((provider) => provider?.mode === "not_configured").length;
  const live = rows.filter((provider) => provider?.mode === "live").length;
  const failed = rows.filter((provider) => ["api_error", "fetch_error", "timeout"].includes(provider?.mode) && provider?.quotaPreflightBlocked !== true).length;
  return {
    requested: allPicks.length,
    observed: rows.length,
    live,
    failed,
    quotaBlocked,
    quotaExhausted: quotaBlocked > 0 && bindingLimits.length > 0,
    bindingLimits,
    unsupported,
    notConfigured,
    usagePreflightChecks: rows.filter((provider) => provider?.usageRequestMade === true).length,
    eventRequests: rows.filter((provider) => provider?.eventRequestMade === true).length,
    acquisition: "protected-worker-only",
    quotaBypassAttempted: false,
    probabilityChanged: false,
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
