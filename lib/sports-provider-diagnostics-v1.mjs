export const SPORTS_PROVIDER_DIAGNOSTICS_VERSION = "scorecaster-sports-provider-diagnostics-v1";

const SAFE_NEWSAPI_ERROR_CODES = new Set([
  "apiKeyDisabled",
  "apiKeyExhausted",
  "apiKeyInvalid",
  "apiKeyMissing",
  "parameterInvalid",
  "parametersMissing",
  "rateLimited",
  "sourcesTooMany",
  "sourceDoesNotExist",
  "unexpectedError"
]);

function clean(value, limit = 180) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function finiteInteger(value, { min = 0, max = 100000 } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function optionalBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function safeStarterCounts(value = {}) {
  const home = finiteInteger(value?.home, { max: 30 });
  const away = finiteInteger(value?.away, { max: 30 });
  return home === null && away === null ? null : { home, away };
}

function safeNewsApiErrorCode(source, value) {
  if (source !== "newsapi") return null;
  const code = clean(value, 60);
  return SAFE_NEWSAPI_ERROR_CODES.has(code) ? code : null;
}

export function safeSportsProviderDiagnostic(section = {}, fallbackSource = "provider") {
  const source = clean(section?.source || fallbackSource, 100) || fallbackSource;
  const mode = clean(section?.mode || "unavailable", 60) || "unavailable";
  const status = finiteInteger(section?.status, { min: 100, max: 599 });
  const count = finiteInteger(section?.count, { max: 500 });
  const rawProviderCount = finiteInteger(section?.rawProviderCount, { max: 5000 });
  const injuryCandidateCount = finiteInteger(section?.injuryCandidateCount, { max: 500 });
  const starterCounts = safeStarterCounts(section?.starterCounts);
  const path = clean(section?.path, 180) || null;
  const fallbackMode = clean(section?.sportsDataFallbackMode || section?.fallbackMode, 60) || null;
  const primaryProviderMode = clean(section?.primaryProviderMode, 60) || null;
  const providerFamily = clean(section?.providerFamily, 80) || null;
  const newsApi = source === "newsapi";

  return {
    version: SPORTS_PROVIDER_DIAGNOSTICS_VERSION,
    source,
    mode,
    ok: section?.ok === true,
    status,
    path,
    providerFamily,
    coverageChecked: section?.coverageChecked === true,
    count,
    rawProviderCount,
    injuryCandidateCount,
    starterCounts,
    fallbackAttempted: section?.fallbackAttempted === true,
    fallbackUsed: section?.fallbackUsed === true,
    fallbackMode,
    primaryProviderMode,
    subscriptionUnavailable:
      section?.subscriptionUnavailable === true ||
      section?.sportsDataSubscriptionUnavailable === true ||
      mode === "subscription_unavailable" ||
      fallbackMode === "subscription_unavailable",
    errorCode: safeNewsApiErrorCode(source, section?.errorCode),
    retryAfterSeconds: newsApi ? finiteInteger(section?.retryAfterSeconds, { max: 86400 }) : null,
    backoffActive: newsApi ? optionalBoolean(section?.backoffActive) : null,
    networkRequestMade: newsApi ? optionalBoolean(section?.networkRequestMade) : null,
    cached: section?.cached === true,
    retrievedAt: clean(section?.retrievedAt, 80) || null,
    rawPayloadRetained: false,
    rawErrorMessageRetained: false,
    credentialRetained: false
  };
}

export function attachSportsProviderDiagnostics(report = {}, intelligence = {}) {
  return {
    ...report,
    providerDiagnostics: {
      version: SPORTS_PROVIDER_DIAGNOSTICS_VERSION,
      news: safeSportsProviderDiagnostic(intelligence?.news, "news-provider"),
      injuries: safeSportsProviderDiagnostic(intelligence?.injuries, "injury-provider"),
      lineup: safeSportsProviderDiagnostic(intelligence?.lineup, "lineup-provider"),
      probabilityChanged: false,
      decisionChanged: false,
      paperOnly: true
    }
  };
}

export const SPORTS_PROVIDER_DIAGNOSTICS_POLICY = Object.freeze({
  rawPayloadRetained: false,
  rawErrorMessageRetained: false,
  credentialRetained: false,
  newsApiErrorCodeAllowlist: true,
  maximumPathLength: 180,
  maximumRetryAfterSeconds: 86400,
  probabilityChanged: false,
  decisionChanged: false,
  stakeChanged: false,
  paperOnly: true
});
