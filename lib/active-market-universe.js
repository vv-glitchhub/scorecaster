import { SPORTS } from "./sports.js";

export const MARKET_FAMILIES = Object.freeze(["h2h", "spreads", "totals"]);

export const OWNED_FOOTBALL_LEAGUES = Object.freeze([
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one"
]);

export const CORE_ACTIVE_LEAGUES = Object.freeze([
  "americanfootball_nfl",
  "basketball_nba",
  "icehockey_finland_liiga",
  "icehockey_nhl",
  "icehockey_sweden_hockey_league",
  ...OWNED_FOOTBALL_LEAGUES
]);

export const SUMMER_ACTIVE_LEAGUES = Object.freeze([
  "baseball_mlb",
  "basketball_wnba",
  "soccer_usa_mls",
  "soccer_finland_veikkausliiga",
  "soccer_sweden_allsvenskan",
  "soccer_norway_eliteserien"
]);

export const TRANSITION_ACTIVE_LEAGUES = Object.freeze([
  ...new Set([...SUMMER_ACTIVE_LEAGUES, ...CORE_ACTIVE_LEAGUES])
]);

const SUPPORTED_LEAGUES = new Set(
  SPORTS.flatMap((group) => group.leagues.map((league) => league.key))
);

function monthOf(now) {
  const date = now instanceof Date ? now : new Date(now);
  return Number.isFinite(date.getTime()) ? date.getUTCMonth() : new Date().getUTCMonth();
}

export function marketSeason(now = Date.now()) {
  const month = monthOf(now);
  if (month === 8 || month === 9) return "transition";
  if (month >= 4 && month <= 7) return "summer";
  return "core-season";
}

export function activeMarketLeagues(now = Date.now()) {
  const season = marketSeason(now);
  const source = season === "summer"
    ? SUMMER_ACTIVE_LEAGUES
    : season === "transition"
      ? TRANSITION_ACTIVE_LEAGUES
      : CORE_ACTIVE_LEAGUES;
  return source.filter((league) => SUPPORTED_LEAGUES.has(league));
}

export function topPicksDefaultLeagues(now = Date.now(), limit = 12) {
  const bounded = Math.max(1, Math.min(16, Number(limit) || 12));
  const active = activeMarketLeagues(now);
  if (marketSeason(now) !== "transition" || active.length <= bounded) return active.slice(0, bounded);

  // During Sep/Oct transition, keep the full owned-football predictive universe
  // represented before filling remaining slots with seasonal sports.
  const owned = OWNED_FOOTBALL_LEAGUES.filter((league) => active.includes(league));
  const rest = active.filter((league) => !owned.includes(league));
  return [...owned, ...rest].slice(0, bounded);
}

export function isSupportedMarketLeague(league) {
  return SUPPORTED_LEAGUES.has(String(league || ""));
}

export function sanitizeMarketLeagues(values = [], { max = 16 } = {}) {
  const boundedMax = Math.max(1, Math.min(16, Number(max) || 16));
  const clean = [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter((value) => SUPPORTED_LEAGUES.has(value)))];
  return clean.slice(0, boundedMax);
}

export function activeMarketUniverse(now = Date.now()) {
  return {
    version: "scorecaster-active-market-universe-v1",
    season: marketSeason(now),
    leagues: activeMarketLeagues(now),
    markets: [...MARKET_FAMILIES],
    ownedFootballLeagues: [...OWNED_FOOTBALL_LEAGUES]
  };
}
