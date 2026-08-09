export const SPORTSGAMEODDS_USAGE_VERSION = "sportsgameodds-usage-v1";
export const SPORTSGAMEODDS_USAGE_CACHE_TTL_MS = 60_000;
export const SPORTSGAMEODDS_USAGE_INTERVALS = Object.freeze([
  "per-second",
  "per-minute",
  "per-hour",
  "per-day",
  "per-month"
]);

function finiteNonNegative(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && ["unlimited", "n/a", "na", "none"].includes(value.trim().toLowerCase())) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Number(number.toFixed(3));
}

function firstFinite(source, keys) {
  for (const key of keys) {
    const value = finiteNonNegative(source?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function boundedRatio(current, maximum) {
  if (current === null || maximum === null || maximum <= 0) return null;
  return Number(Math.max(0, current / maximum).toFixed(4));
}

function intervalUsage(source = {}) {
  const maxRequests = firstFinite(source, ["max-requests", "maxRequestsPerInterval", "maxRequests", "requestLimit"]);
  const currentRequests = firstFinite(source, ["current-requests", "currentIntervalRequests", "currentRequests", "requestsUsed"]);
  const maxEntities = firstFinite(source, ["max-entities", "maxEntitiesPerInterval", "maxEntities", "entityLimit", "maxObjects"]);
  const currentEntities = firstFinite(source, ["current-entities", "currentIntervalEntities", "currentEntities", "entitiesUsed", "currentObjects"]);
  return {
    maxRequests,
    currentRequests,
    requestRatio: boundedRatio(currentRequests, maxRequests),
    maxEntities,
    currentEntities,
    entityRatio: boundedRatio(currentEntities, maxEntities)
  };
}

export function sanitizeSportsGameOddsUsagePayload(payload) {
  const data = payload?.success === true && payload?.data && typeof payload.data === "object" ? payload.data : null;
  if (!data) return null;
  const rateLimits = data.rateLimits && typeof data.rateLimits === "object" ? data.rateLimits : {};
  const intervals = {};
  const bindingLimits = [];

  for (const interval of SPORTSGAMEODDS_USAGE_INTERVALS) {
    const safe = intervalUsage(rateLimits[interval]);
    intervals[interval] = safe;
    if (safe.requestRatio !== null && safe.requestRatio >= 1) bindingLimits.push(`${interval}:requests`);
    if (safe.entityRatio !== null && safe.entityRatio >= 1) bindingLimits.push(`${interval}:entities`);
  }

  return {
    version: SPORTSGAMEODDS_USAGE_VERSION,
    isActive: typeof data.isActive === "boolean" ? data.isActive : null,
    intervals,
    bindingLimits,
    identifiersRetained: false,
    emailRetained: false,
    rawPayloadRetained: false
  };
}

export function safeSportsGameOddsUsageEvidence(value) {
  if (!value || typeof value !== "object") return null;
  const intervals = {};
  for (const interval of SPORTSGAMEODDS_USAGE_INTERVALS) {
    intervals[interval] = intervalUsage(value.intervals?.[interval]);
  }
  const bindingLimits = Array.isArray(value.bindingLimits)
    ? value.bindingLimits
        .map((item) => String(item || "").trim())
        .filter((item) => /^(per-second|per-minute|per-hour|per-day|per-month):(requests|entities)$/.test(item))
        .slice(0, 10)
    : [];
  return {
    version: SPORTSGAMEODDS_USAGE_VERSION,
    isActive: typeof value.isActive === "boolean" ? value.isActive : null,
    intervals,
    bindingLimits,
    identifiersRetained: false,
    emailRetained: false,
    rawPayloadRetained: false
  };
}

export function evaluateSportsGameOddsQuotaPreflight(value) {
  const usage = safeSportsGameOddsUsageEvidence(value);
  const bindingLimits = usage?.bindingLimits || [];
  const blocked = bindingLimits.length > 0;
  return {
    blocked,
    mode: blocked ? "quota_exhausted" : "available",
    bindingLimits,
    usage,
    eventRequestAllowed: !blocked,
    probabilityChanged: false,
    matchingThresholdChanged: false,
    paperOnly: true
  };
}
