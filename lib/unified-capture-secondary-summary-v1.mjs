export const UNIFIED_CAPTURE_SECONDARY_SUMMARY_VERSION = "scorecaster-unified-capture-secondary-summary-v1";

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
    version: UNIFIED_CAPTURE_SECONDARY_SUMMARY_VERSION,
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
