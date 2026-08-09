const HOUR_MS = 60 * 60 * 1000;
export const SPORTSGAMEODDS_BATCH_BUCKET_MS = 24 * HOUR_MS;
export const SPORTSGAMEODDS_RATE_LIMIT_FALLBACK_MS = 60 * 1000;

export function buildSportsGameOddsRequestWindow(centerMs, matchWindowMs) {
  const center = Number.isFinite(Number(centerMs)) ? Number(centerMs) : Date.now();
  const overlap = Math.max(HOUR_MS, Number.isFinite(Number(matchWindowMs)) ? Number(matchWindowMs) : 8 * HOUR_MS);
  const bucketStartMs = Math.floor(center / SPORTSGAMEODDS_BATCH_BUCKET_MS) * SPORTSGAMEODDS_BATCH_BUCKET_MS;
  const startsAfterMs = bucketStartMs - overlap;
  const startsBeforeMs = bucketStartMs + SPORTSGAMEODDS_BATCH_BUCKET_MS + overlap;
  return {
    bucketStartMs,
    bucketKey: new Date(bucketStartMs).toISOString().slice(0, 10),
    startsAfter: new Date(startsAfterMs).toISOString(),
    startsBefore: new Date(startsBeforeMs).toISOString(),
    spanHours: (startsBeforeMs - startsAfterMs) / HOUR_MS
  };
}

export function sportsGameOddsRateLimitCooldownMs(retryAfterSeconds) {
  const seconds = Number(retryAfterSeconds);
  const providerDelay = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 0;
  return Math.max(SPORTSGAMEODDS_RATE_LIMIT_FALLBACK_MS, providerDelay);
}
