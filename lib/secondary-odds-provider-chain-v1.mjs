import { fetchSportsGameOddsForMatch } from "./sportsgameodds-provider.js";
import { fetchSportsDataOddsForMatch } from "./sportsdata-odds-provider.js";

export const SECONDARY_ODDS_PROVIDER_CHAIN_VERSION = "scorecaster-secondary-odds-provider-chain-v1";

function clean(value, limit = 120) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function isWnba(match = {}) {
  return clean(match.sportKey || match.sport || match.league, 120).toLowerCase().includes("wnba");
}

function safeAttempt(result = {}) {
  return {
    source: clean(result?.source || "unknown", 60),
    mode: clean(result?.mode || "unavailable", 60),
    status: Number.isFinite(Number(result?.status)) ? Number(result.status) : null,
    quotaPreflightBlocked: result?.quotaPreflightBlocked === true,
    subscriptionUnavailable: result?.subscriptionUnavailable === true,
    eventRequestMade: result?.eventRequestMade === true,
    usageRequestMade: result?.usageRequestMade === true,
    matchConfidence: Number.isFinite(Number(result?.matchConfidence)) ? Number(result.matchConfidence) : null
  };
}

export async function fetchVerifiedSecondaryOddsForMatch(
  match = {},
  {
    preflightUsage = true,
    fetchSportsGameOdds = fetchSportsGameOddsForMatch,
    fetchSportsDataOdds = fetchSportsDataOddsForMatch
  } = {}
) {
  const primaryAttempt = await fetchSportsGameOdds(match, { preflightUsage });
  if (primaryAttempt?.mode === "live" && primaryAttempt?.ok === true) {
    return {
      ...primaryAttempt,
      providerChainVersion: SECONDARY_ODDS_PROVIDER_CHAIN_VERSION,
      providerAttempts: [safeAttempt(primaryAttempt)],
      fallbackUsed: false
    };
  }

  if (!isWnba(match)) {
    return {
      ...primaryAttempt,
      providerChainVersion: SECONDARY_ODDS_PROVIDER_CHAIN_VERSION,
      providerAttempts: [safeAttempt(primaryAttempt)],
      fallbackUsed: false
    };
  }

  const fallbackAttempt = await fetchSportsDataOdds(match);
  const providerAttempts = [safeAttempt(primaryAttempt), safeAttempt(fallbackAttempt)];
  if (fallbackAttempt?.mode === "live" && fallbackAttempt?.ok === true) {
    return {
      ...fallbackAttempt,
      usageRequestMade: primaryAttempt?.usageRequestMade === true,
      quotaPreflightBlocked: primaryAttempt?.quotaPreflightBlocked === true,
      providerChainVersion: SECONDARY_ODDS_PROVIDER_CHAIN_VERSION,
      providerAttempts,
      fallbackUsed: true,
      fallbackReason: clean(primaryAttempt?.mode || "primary-secondary-unavailable", 80),
      fallbackFrom: safeAttempt(primaryAttempt)
    };
  }

  return {
    ...primaryAttempt,
    providerChainVersion: SECONDARY_ODDS_PROVIDER_CHAIN_VERSION,
    providerAttempts,
    fallbackUsed: false,
    fallbackAttempted: true,
    fallbackMode: clean(fallbackAttempt?.mode || "unavailable", 80),
    fallbackSubscriptionUnavailable: fallbackAttempt?.subscriptionUnavailable === true
  };
}

export const SECONDARY_ODDS_PROVIDER_CHAIN_POLICY = Object.freeze({
  order: ["sportsgameodds", "sportsdataio-wnba"],
  fallbackLeagues: ["basketball_wnba"],
  noQuotaBypass: true,
  oneIndependentProviderFamilyPerSuccessfulAdapter: true,
  probabilityChanged: false,
  decisionChanged: false,
  paperOnly: true
});
