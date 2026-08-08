export const LIVE_DATA_CACHE_BOUNDARY_VERSION = "scorecaster-live-data-cache-boundary-v1";

const lower = (value) => String(value ?? "").trim().toLowerCase();

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === wanted) return value == null ? null : String(value);
  }
  return null;
}

export function evaluateLiveDataResponseHeaders(headers, policy = {}) {
  const cacheControl = lower(headerValue(headers, "cache-control"));
  const ageRaw = headerValue(headers, "age");
  const age = ageRaw == null || ageRaw === "" ? null : Number(ageRaw);
  const vercelCache = String(headerValue(headers, "x-vercel-cache") ?? "").trim().toUpperCase() || null;
  const requiredTokens = Array.isArray(policy.requiredCacheControlTokens)
    ? policy.requiredCacheControlTokens.map((token) => lower(token)).filter(Boolean)
    : ["no-store"];
  const forbiddenStates = new Set((policy.forbiddenVercelCacheStates || ["HIT", "STALE"]).map((item) => String(item).toUpperCase()));
  const maximumAge = Number.isFinite(Number(policy.maximumAgeHeaderSeconds))
    ? Number(policy.maximumAgeHeaderSeconds)
    : 0;
  const failures = [];

  for (const token of requiredTokens) {
    if (!cacheControl.includes(token)) failures.push(`missing-cache-control-token:${token}`);
  }
  if (age !== null && (!Number.isFinite(age) || age > maximumAge)) failures.push("cached-age-header-present");
  if (vercelCache && forbiddenStates.has(vercelCache)) failures.push(`forbidden-vercel-cache-state:${vercelCache}`);

  return {
    passed: failures.length === 0,
    cacheControl: cacheControl || null,
    age: Number.isFinite(age) ? age : age === null ? null : "invalid",
    vercelCache,
    failures
  };
}

export function redactCacheProbeHeaders(headers, allowlist = []) {
  const result = {};
  for (const name of allowlist) {
    const value = headerValue(headers, name);
    if (value != null && value !== "") result[String(name).toLowerCase()] = String(value).slice(0, 240);
  }
  return result;
}
