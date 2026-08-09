import { loadUnifiedSportsData } from "./unified-sports-data-service.js";
import { applyUnifiedDataSafety, buildUnifiedSportsDataLedger } from "./unified-sports-data-v1.mjs";

export const UNIFIED_CAPTURE_ENRICHMENT_VERSION = "scorecaster-unified-capture-enrichment-v1";
export const UNIFIED_CAPTURE_CONCURRENCY = 4;

export async function enrichPickForUnifiedCapture(
  pick,
  {
    now = Date.now(),
    loadUnified = loadUnifiedSportsData
  } = {}
) {
  const report = pick?.sportsIntelligence || {};
  try {
    const unified = await loadUnified(pick, report, {
      now,
      allowLiveSecondaryPricing: true
    });
    return {
      ...applyUnifiedDataSafety(pick, unified.ledger),
      unifiedDataProviders: unified.providers,
      unifiedDataCached: unified.cached,
      unifiedDataGeneratedAt: unified.generatedAt,
      secondaryPricingAcquisition: "live-worker-capture",
      unifiedCaptureEnrichment: UNIFIED_CAPTURE_ENRICHMENT_VERSION
    };
  } catch {
    const ledger = buildUnifiedSportsDataLedger({ pick, sportsReport: report, now });
    return {
      ...applyUnifiedDataSafety(pick, ledger),
      unifiedDataProviders: pick?.unifiedDataProviders || {},
      unifiedDataCached: false,
      unifiedDataGeneratedAt: new Date(now).toISOString(),
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
