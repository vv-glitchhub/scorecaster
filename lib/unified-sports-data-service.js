import { fetchSportsGameOddsForMatch } from "./sportsgameodds-provider";
import { fetchSportsContextForMatch } from "./sports-context-provider";
import { fetchWeatherForMatch } from "./open-meteo-provider";
import { buildUnifiedSportsDataLedger } from "./unified-sports-data-v1.mjs";

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

function cacheKey(pick = {}) {
  return [
    pick.gameId || pick.eventId || pick.id,
    pick.selection || pick.label,
    pick.odds,
    pick.lastUpdate || pick.updatedAt,
    pick.sportKey || pick.league
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

export async function loadUnifiedSportsData(pick = {}, sportsReport = {}, { now = Date.now() } = {}) {
  const match = matchFromPick(pick);
  if (!match.homeTeam || !match.awayTeam || !match.sportKey) {
    return {
      ok: false,
      error: "Unified sports data requires a verified event, teams and sport key",
      ledger: buildUnifiedSportsDataLedger({ pick, sportsReport, now })
    };
  }

  const key = cacheKey(pick);
  const cached = readCache(key, now);
  if (cached) return { ...cached, cached: true };

  const [secondaryOdds, context] = await Promise.all([
    fetchSportsGameOddsForMatch(match),
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

  const ledger = buildUnifiedSportsDataLedger({ pick, sportsReport, secondaryOdds, context, weather, now });
  const payload = {
    ok: true,
    version: "unified-sports-data-service-v1",
    generatedAt: new Date(now).toISOString(),
    match,
    providers: {
      primaryOdds: { source: "the-odds-api", mode: pick.fixtureVerifiedByProvider ? "live" : "unknown" },
      secondaryOdds: { source: secondaryOdds.source, mode: secondaryOdds.mode, ok: secondaryOdds.ok },
      sportsContext: { source: context.source, mode: context.mode, ok: context.ok },
      weather: { source: weather.source, mode: weather.mode, ok: weather.ok },
      injuries: { source: sportsReport.providerLive?.injuries ? "sportsdata" : "unavailable", mode: sportsReport.providerLive?.injuries ? "live" : "not_verified" },
      lineups: { source: sportsReport.providerLive?.lineup ? "lineup-provider" : "unavailable", mode: sportsReport.providerLive?.lineup ? "live" : "not_verified" },
      news: { source: sportsReport.providerLive?.news ? "newsapi" : "unavailable", mode: sportsReport.providerLive?.news ? "live" : "not_verified" }
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
