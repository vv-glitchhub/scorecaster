export const UNIFIED_CAPTURE_FRESHNESS_VERSION = "scorecaster-unified-capture-freshness-v1";
export const UNIFIED_CAPTURE_FRESHNESS_MINUTES = 15;

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function evaluateUnifiedCaptureFreshness({
  latestCapturedAt,
  now = Date.now(),
  thresholdMinutes = UNIFIED_CAPTURE_FRESHNESS_MINUTES
} = {}) {
  const threshold = Math.max(1, Math.min(60, Math.trunc(finite(thresholdMinutes) ?? UNIFIED_CAPTURE_FRESHNESS_MINUTES)));
  const latestMs = Date.parse(String(latestCapturedAt || ""));
  if (!Number.isFinite(latestMs)) {
    return {
      version: UNIFIED_CAPTURE_FRESHNESS_VERSION,
      fresh: false,
      latestCapturedAt: null,
      ageMinutes: null,
      thresholdMinutes: threshold,
      protectedWorkerRequired: true,
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
    protectedWorkerRequired: !fresh,
    paperOnly: true
  };
}

export const UNIFIED_CAPTURE_FRESHNESS_POLICY = Object.freeze({
  thresholdMinutes: UNIFIED_CAPTURE_FRESHNESS_MINUTES,
  comparison: "strictly-less-than-threshold",
  missingLatestCaptureMeansStale: true,
  publicFields: ["fresh", "latestCapturedAt", "ageMinutes", "thresholdMinutes", "protectedWorkerRequired", "paperOnly"],
  eventIdsExposed: false,
  selectionsExposed: false,
  providersExposed: false,
  credentialsExposed: false,
  probabilityChanged: false,
  decisionChanged: false,
  stakeChanged: false,
  paperOnly: true
});
