export const SPORTS_PROVIDER_DIAGNOSTICS_VERSION = "scorecaster-sports-provider-diagnostics-v1";

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

function safeStarterCounts(value = {}) {
  const home = finiteInteger(value?.home, { max: 30 });
  const away = finiteInteger(value?.away, { max: 30 });
  return home === null && away === null ? null : { home, away };
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
    cached: section?.cached === true,
    retrievedAt: clean(section?.retrievedAt, 80) || null,
    rawPayloadRetained: false,
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
  credentialRetained: false,
  maximumPathLength: 180,
  probabilityChanged: false,
  decisionChanged: false,
  stakeChanged: false,
  paperOnly: true
});
