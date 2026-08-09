import { fetchSportsGameOddsForMatch } from "./sportsgameodds-provider.js";
import { safeSportsGameOddsMatchDiagnostics } from "./sportsgameodds-match-v3.mjs";
import { safeSportsGameOddsUpstreamEvidence } from "./sportsgameodds-upstream-v1.mjs";
import { mergeSecondaryPricingIntoCaptureLedger } from "./unified-capture-ledger-merge-v1.mjs";

export const UNIFIED_CAPTURE_ENRICHMENT_VERSION = "scorecaster-unified-capture-enrichment-v2";
export const UNIFIED_CAPTURE_CONCURRENCY = 4;

const clean = (value, limit = 180) => String(value || "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const boundedConfidence = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? Number(number.toFixed(3)) : null;
};

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

function secondaryProviderEvidence(secondaryOdds = {}) {
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
  return {
    source: clean(secondaryOdds.source || "sportsgameodds", 100),
    mode: clean(secondaryOdds.mode || "unknown", 40),
    ok: secondaryOdds.ok === true,
    acquisition: "live-worker-capture",
    networkRequestMade: true,
    observedAt: secondaryOdds.retrievedAt || null,
    matchConfidence: boundedConfidence(secondaryOdds.matchConfidence ?? secondaryOdds.data?.matchConfidence),
    matchDiagnostics: secondaryOdds.matchDiagnostics
      ? safeSportsGameOddsMatchDiagnostics(secondaryOdds.matchDiagnostics)
      : null,
    upstream
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
    const secondaryOdds = await fetchSecondary(matchFromPick(pick));
    const merged = mergeSecondaryPricingIntoCaptureLedger({
      pick,
      baseLedger: pick?.unifiedSportsData || null,
      secondaryOdds,
      now
    });
    return {
      ...pick,
      unifiedSportsData: merged.ledger || pick?.unifiedSportsData || null,
      unifiedDataProviders: {
        ...(pick?.unifiedDataProviders || {}),
        secondaryOdds: secondaryProviderEvidence(secondaryOdds)
      },
      unifiedDataGeneratedAt: new Date(now).toISOString(),
      secondaryPricingAcquisition: "live-worker-capture",
      unifiedCaptureEnrichment: UNIFIED_CAPTURE_ENRICHMENT_VERSION,
      captureLedgerMergeReason: merged.reason,
      captureInvariant: {
        probabilityChanged: false,
        decisionChanged: false,
        stakeChanged: false,
        contextImpactChanged: false,
        publicExplanationRewritten: false
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
          observedAt: null,
          matchConfidence: null,
          matchDiagnostics: null,
          upstream: null
        }
      },
      unifiedDataGeneratedAt: new Date(now).toISOString(),
      secondaryPricingAcquisition: "worker-capture-failed-closed",
      unifiedCaptureEnrichment: UNIFIED_CAPTURE_ENRICHMENT_VERSION,
      captureLedgerMergeReason: "secondary-fetch-threw",
      captureInvariant: {
        probabilityChanged: false,
        decisionChanged: false,
        stakeChanged: false,
        contextImpactChanged: false,
        publicExplanationRewritten: false
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
