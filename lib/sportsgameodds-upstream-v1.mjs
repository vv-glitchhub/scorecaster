import { safeSportsGameOddsUsageEvidence } from "./sportsgameodds-usage-v1.mjs";

export const SPORTSGAMEODDS_UPSTREAM_VERSION = "scorecaster-sportsgameodds-upstream-v1";

export const SPORTSGAMEODDS_ERROR_CATEGORIES = Object.freeze([
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  "provider_server_error",
  "provider_unavailable",
  "provider_timeout",
  "network_error",
  "invalid_response",
  "unknown_http_error"
]);

const RETRYABLE = new Set([
  "provider_server_error",
  "provider_unavailable",
  "provider_timeout",
  "network_error",
  "invalid_response"
]);

export function classifySportsGameOddsStatus(status) {
  const code = Number(status);
  if (!Number.isInteger(code)) return "unknown_http_error";
  if (code === 400) return "bad_request";
  if (code === 401) return "unauthorized";
  if (code === 403) return "forbidden";
  if (code === 404) return "not_found";
  if (code === 429) return "rate_limited";
  if (code === 503) return "provider_unavailable";
  if (code === 504) return "provider_timeout";
  if (code >= 500 && code <= 599) return "provider_server_error";
  return "unknown_http_error";
}

export function parseSportsGameOddsRetryAfter(value, { now = Date.now(), maximumSeconds = 3600 } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return Math.max(0, Math.min(maximumSeconds, Math.ceil(Number(text))));
  }
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(maximumSeconds, Math.ceil((parsed - now) / 1000)));
}

export function isSportsGameOddsRetryableCategory(category) {
  return RETRYABLE.has(String(category || ""));
}

export function sportsGameOddsNetworkCategory(error) {
  const name = String(error?.name || "");
  return name === "TimeoutError" || name === "AbortError" ? "provider_timeout" : "network_error";
}

export function safeSportsGameOddsUpstreamEvidence({
  status = null,
  errorCategory = null,
  retryAfterSeconds = null,
  attempts = 1,
  retried = false,
  usage = null
} = {}) {
  const numericStatus = Number(status);
  const statusValue = Number.isInteger(numericStatus) && numericStatus >= 100 && numericStatus <= 599
    ? numericStatus
    : null;
  const category = SPORTSGAMEODDS_ERROR_CATEGORIES.includes(String(errorCategory || ""))
    ? String(errorCategory)
    : statusValue === null ? "unknown_http_error" : classifySportsGameOddsStatus(statusValue);
  const retryAfter = Number(retryAfterSeconds);
  const didRetry = Boolean(retried);
  const attemptCount = Number(attempts);
  const boundedAttempts = Number.isInteger(attemptCount) && attemptCount >= 0 && attemptCount <= 2
    ? attemptCount
    : didRetry ? 2 : 1;
  const normalizedRetried = boundedAttempts >= 2 ? didRetry : false;
  return {
    httpStatus: statusValue,
    errorCategory: category,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter >= 0
      ? Math.min(3600, Math.ceil(retryAfter))
      : null,
    attempts: boundedAttempts,
    retried: normalizedRetried,
    usage: safeSportsGameOddsUsageEvidence(usage)
  };
}

export function sportsGameOddsBackoffMs(attempt) {
  return Number(attempt) === 1 ? 400 : 0;
}
