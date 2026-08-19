import { fetchSportsGameOddsForMatch } from "./sportsgameodds-provider";
import { safeSportsGameOddsMatchDiagnostics } from "./sportsgameodds-match-v3.mjs";
import { safeSportsGameOddsUpstreamEvidence } from "./sportsgameodds-upstream-v1.mjs";
import { workerOnlySecondaryProviderState } from "./secondary-provider-acquisition-policy-v1.mjs";
import { fetchSportsContextForMatch } from "./sports-context-provider";
import { fetchWeatherForMatch } from "./open-meteo-provider";
import { buildUnifiedSportsDataLedgerWithLineupProvenance } from "./unified-lineup-provenance-v1.mjs";
import { applyPregameEvidenceCoverage } from "./pregame-evidence-coverage-v1.mjs";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_LIMIT = 500;
const GLOBAL_CACHE_KEY = "__scorecasterUnifiedSportsDataCacheV1";

function cacheStore() {
  if (!globalThis[GLOBAL_CACHE_KEY]) globalThis[GLOBAL_CACHE_KEY] = new Map();
  return globalThis[GLOBAL_CACHE_KEY];
}

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function boundedConfidence(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) return null;
  return Number(number.toFixed(3));
}

function finiteInteger(value, max = 100000) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(max, Math.trunc(number))) : null;
}

function optionalBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function matchFromPick(pick = {}) {
  return {
    eventId: clean(pick.gameId || pick.eventId || pick.id, 180) || null,
    homeTeam: clean(pick.homeTeam, 140),
    awayTeam: clean(pick.awayTeam, 140),
    sportKey: clean(pick.sportKey || pick.league, 120),
    sport: clean(pick.sportTitle || pick.sportKey, 120),
    league: clean(pick.leagueTitle || pick.league, 140),
    commenceTime: pick.commenceTime || pick.commence_time || null,
    venue: pick.venue || pick.stadium || null,
    latitude: pick.latitude ?? pick.venueLatitude ?? null,
    longitude: pick.longitude ?? pick.venueLongitude ?? null,
    indoor: pick.indoor,
    outdoor: pick.outdoor
  };
}

function cacheKey(pick = {}, acquisitionMode = "worker-only") {
  return [
    pick.gameId || pick.eventId || pick.id,
    pick.selection || pick.label,
    pick.odds,
    pick.lastUpdate || pick.updatedAt,
    pick.sportKey || pick.league,
    acquisitionMode
  ].map((value) => String(value || "").toLowerCase()).join("|");
}

function readCache(key, now) {
  const store = cacheStore();
  const row = store.get(key);
  if (!row) return null;
  if (now - row.createdAt > CACHE_TTL_MS) {
    store.delete(key);
    return null;
  }
  return row.payload;
}

function writeCache(key, payload, now) {
  const store = cacheStore();
  if (store.size >= CACHE_LIMIT) {
    [...store.entries()]
      .sort((left, right) => left[1].createdAt - right[1].createdAt)
      .slice(0, 50)
      .forEach(([entryKey]) => store.delete(entryKey));
  }
  store.set(key, { createdAt: now, payload });
}

function safeDiagnostic(report = {}, key) {
  const diagnostic = report?.providerDiagnostics?.[key];
  return diagnostic && typeof diagnostic === "object" ? diagnostic : null;
}

function providerBlockerFields(diagnostic = null) {
  if (!diagnostic) return {};
  return {
    status: finiteInteger(diagnostic.status, 599),
    path: clean(diagnostic.path, 180) || null,
    providerFamily: clean(diagnostic.providerFamily, 80) || null,
    coverageChecked: diagnostic.coverageChecked === true,
    count: finiteInteger(diagnostic.count, 500),
    rawProviderCount: finiteInteger(diagnostic.rawProviderCount, 5000),
    injuryCandidateCount: finiteInteger(diagnostic.injuryCandidateCount, 500),
    starterCounts: diagnostic.starterCounts && typeof diagnostic.starterCounts === "object"
      ? {
          home: finiteInteger(diagnostic.starterCounts.home, 30),
          away: finiteInteger(diagnostic.starterCounts.away, 30)
        }
      : null,
    fallbackAttempted: diagnostic.fallbackAttempted === true,
    fallbackUsed: diagnostic.fallbackUsed === true,
    fallbackMode: clean(diagnostic.fallbackMode, 60) || null,
    primaryProviderMode: clean(diagnostic.primaryProviderMode, 60) || null,
    subscriptionUnavailable: diagnostic.subscriptionUnavailable === true,
    errorCode: clean(diagnostic.errorCode, 60) || null,
    retryAfterSeconds: finiteInteger(diagnostic.retryAfterSeconds, 86400),
    backoffActive: optionalBoolean(diagnostic.backoffActive),
    networkRequestMade: optionalBoolean(diagnostic.networkRequestMade),
    retrievedAt: clean(diagnostic.retrievedAt, 80) || null,
    rawPayloadRetained: false,
    rawErrorMessageRetained: false,
    credentialRetained: false
  };
}

function injuryProviderSummary(sportsReport = {}) {
  const diagnostic = safeDiagnostic(sportsReport, "injuries");
  if (diagnostic) {
    return {
      source: clean(diagnostic.source, 100) || (sportsReport.providerLive?.injuries ? "sportsdata" : "unavailable"),
      mode: clean(diagnostic.mode, 60) || (sportsReport.providerLive?.injuries ? "live" : "not_verified"),
      ok: diagnostic.ok === true,
      ...providerBlockerFields(diagnostic)
    };
  }
  return {
    source: sportsReport.providerLive?.injuries ? "sportsdata" : "unavailable",
    mode: sportsReport.providerLive?.injuries ? "live" : "not_verified",
    ok: sportsReport.providerLive?.injuries === true
  };
}

function lineupProviderSummary(sportsReport = {}) {
  const rows = Array.isArray(sportsReport?.lineups) ? sportsReport.lineups : [];
  const sources = [...new Set(rows.map((row) => clean(row?.source, 100)).filter(Boolean))].slice(0, 6);
  const starterCount = rows.reduce((sum, row) => sum + (Array.isArray(row?.startingPlayers) ? row.startingPlayers.length : 0), 0);
  const diagnostic = safeDiagnostic(sportsReport, "lineup");
  return {
    source: sources[0] || clean(diagnostic?.source, 100) || (sportsReport.providerLive?.lineup ? "lineup-provider" : "unavailable"),
    sources,
    mode: clean(diagnostic?.mode, 60) || (sportsReport.providerLive?.lineup ? "live" : "not_verified"),
    ok: diagnostic ? diagnostic.ok === true : sportsReport.providerLive?.lineup === true,
    verifiedTeams: rows.filter((row) => row?.startersConfirmed === true).length,
    starterCount,
    provenanceAttached: starterCount > 0,
    ...providerBlockerFields(diagnostic)
  };
}

function newsProviderSummary(sportsReport = {}) {
  const diagnostic = safeDiagnostic(sportsReport, "news");
  return {
    source: clean(diagnostic?.source, 100) || (sportsReport.providerLive?.news ? "newsapi" : "unavailable"),
    mode: clean(diagnostic?.mode, 60) || (sportsReport.providerLive?.news ? "live" : "not_verified"),
    ok: diagnostic ? diagnostic.ok === true : sportsReport.providerLive?.news === true,
    ...providerBlockerFields(diagnostic)
  };
}

export async function loadUnifiedSportsData(
  pick = {},
  sportsReport = {},
  { now = Date.now(), allowLiveSecondaryPricing = false } = {}
) {
  const match = matchFromPick(pick);
  if (!match.homeTeam || !match.awayTeam || !match.sportKey) {
    return {
      ok: false,
      error: "Unified sports data requires a verified event, teams and sport key",
      ledger: applyPregameEvidenceCoverage(buildUnifiedSportsDataLedgerWithLineupProvenance({ pick, sportsReport, now }))
    };
  }

  const acquisitionMode = allowLiveSecondaryPricing ? "live-worker-capture" : "worker-only";
  const key = cacheKey(pick, acquisitionMode);
  const cached = readCache(key, now);
  if (cached) return { ...cached, cached: true };

  const [secondaryOdds, context] = await Promise.all([
    allowLiveSecondaryPricing
      ? fetchSportsGameOddsForMatch(match)
      : Promise.resolve(workerOnlySecondaryProviderState({ retrievedAt: new Date(now).toISOString() })),
    fetchSportsContextForMatch(match)
  ]);
  const contextVenue = context?.mode === "live" ? context.data?.venue : null;
  const weather = await fetchWeatherForMatch({
    ...match,
    venue: contextVenue?.name || match.venue,
    latitude: contextVenue?.latitude ?? match.latitude,
    longitude: contextVenue?.longitude ?? match.longitude,
    indoor: contextVenue?.indoor ?? match.indoor
  });

  const ledger = applyPregameEvidenceCoverage(buildUnifiedSportsDataLedgerWithLineupProvenance({ pick, sportsReport, secondaryOdds, context, weather, now }));
  const upstream = secondaryOdds.errorCategory
    ? safeSportsGameOddsUpstreamEvidence({
        status: secondaryOdds.status,
        errorCategory: secondaryOdds.errorCategory,
        retryAfterSeconds: secondaryOdds.retryAfterSeconds,
        attempts: secondaryOdds.attempts,
        retried: secondaryOdds.retried,
        usage: secondaryOdds.usage
      })
    : null;
  const payload = {
    ok: true,
    version: "unified-sports-data-service-v1",
    generatedAt: new Date(now).toISOString(),
    acquisitionMode,
    match,
    providers: {
      primaryOdds: { source: "the-odds-api", mode: pick.fixtureVerifiedByProvider ? "live" : "unknown" },
      secondaryOdds: {
        source: secondaryOdds.source,
        mode: secondaryOdds.mode,
        ok: secondaryOdds.ok,
        acquisition: acquisitionMode,
        networkRequestMade: Boolean(secondaryOdds.eventRequestMade),
        quotaPreflightBlocked: secondaryOdds.quotaPreflightBlocked === true,
        matchConfidence: boundedConfidence(secondaryOdds.matchConfidence ?? secondaryOdds.data?.matchConfidence),
        matchDiagnostics: secondaryOdds.matchDiagnostics
          ? safeSportsGameOddsMatchDiagnostics(secondaryOdds.matchDiagnostics)
          : null,
        upstream
      },
      sportsContext: { source: context.source, mode: context.mode, ok: context.ok },
      weather: { source: weather.source, mode: weather.mode, ok: weather.ok },
      injuries: injuryProviderSummary(sportsReport),
      lineups: lineupProviderSummary(sportsReport),
      news: newsProviderSummary(sportsReport)
    },
    raw: {
      secondaryOdds,
      context,
      weather
    },
    ledger,
    cached: false,
    paperOnly: true
  };

  writeCache(key, payload, now);
  return payload;
}

export function resetUnifiedSportsDataCacheForTests() {
  cacheStore().clear();
}

export const UNIFIED_SPORTS_DATA_CACHE_TTL_MS = CACHE_TTL_MS;
