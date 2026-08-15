export const UNIFIED_CAPTURE_FRESHNESS_VERSION = "scorecaster-unified-capture-freshness-v1";
export const UNIFIED_CAPTURE_MAX_SKIP_MINUTES = 20;

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeFreshSkipMinutes(value) {
  const parsed = finite(value);
  if (parsed === null || parsed <= 0) return 0;
  return Math.min(UNIFIED_CAPTURE_MAX_SKIP_MINUTES, Math.max(1, Math.trunc(parsed)));
}

export function evaluateUnifiedCaptureFreshness({
  latestCapturedAt,
  now = Date.now(),
  thresholdMinutes = 0
} = {}) {
  const threshold = normalizeFreshSkipMinutes(thresholdMinutes);
  const latestMs = Date.parse(String(latestCapturedAt || ""));
  if (!threshold || !Number.isFinite(latestMs)) {
    return {
      version: UNIFIED_CAPTURE_FRESHNESS_VERSION,
      fresh: false,
      latestCapturedAt: Number.isFinite(latestMs) ? new Date(latestMs).toISOString() : null,
      ageMinutes: Number.isFinite(latestMs) ? Number(Math.max(0, (now - latestMs) / 60_000).toFixed(2)) : null,
      thresholdMinutes: threshold,
      providerRequestsAllowed: true,
      paperOnly: true
    };
  }

  const ageMinutes = Math.max(0, (now - latestMs) / 60_000);
  const fresh = ageMinutes < threshold;
  return {
    version: UNIFIED_CAPTURE_FRESHNESS_VERSION,
    fresh,
    latestCapturedAt: new Date(latestMs).toISOString(),
    ageMinutes: Number(ageMinutes.toFixed(2)),
    thresholdMinutes: threshold,
    providerRequestsAllowed: !fresh,
    paperOnly: true
  };
}

export const UNIFIED_CAPTURE_FRESHNESS_POLICY = Object.freeze({
  maximumSkipMinutes: UNIFIED_CAPTURE_MAX_SKIP_MINUTES,
  comparison: "strictly-less-than-threshold",
  missingLatestCaptureMeansStale: true,
  providerRequestsAllowedWhenStale: true,
  providerRequestsAllowedWhenFresh: false,
  paperOnly: true
});
