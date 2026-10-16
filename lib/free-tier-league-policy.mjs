import { OWNED_FOOTBALL_LEAGUES } from "./active-market-universe.js";

// Capturing durable history is NOT the same as offering a league in live
// discovery. C-tier games may still be viewed live. No data deletion occurs.
export const CAPTURE_TIER_A = Object.freeze([...OWNED_FOOTBALL_LEAGUES]);
export const CAPTURE_TIER_B = Object.freeze([
  "icehockey_nhl", "basketball_nba", "americanfootball_nfl",
  "icehockey_sweden_hockey_league",
  "soccer_finland_veikkausliiga", "soccer_sweden_allsvenskan"
]);
export const CAPTURE_TIER_C = Object.freeze([
  "soccer_usa_mls", "baseball_mlb", "basketball_wnba",
  "soccer_norway_eliteserien"
]);

const CORE = new Set(CAPTURE_TIER_A);
const SECONDARY = new Set(CAPTURE_TIER_B);
const EXPLORATORY = new Set(CAPTURE_TIER_C);

// Unknown leagues must not silently consume Free historical storage.
export function durableLeagueTier(sportKey) {
  const key = String(sportKey || "").trim();
  if (CORE.has(key)) return "A";
  if (SECONDARY.has(key)) return "B";
  if (EXPLORATORY.has(key)) return "C";
  return "unclassified";
}

export function allowsScheduledHistoricalCapture(sportKey) {
  return ["A", "B"].includes(durableLeagueTier(sportKey));
}

// This never mutates the original picks. Canonical sportKey takes precedence,
// since league is frequently a human-readable display label.
export function selectScheduledHistoricalPicks(picks = []) {
  return (Array.isArray(picks) ? picks : []).filter((pick) =>
    allowsScheduledHistoricalCapture(pick?.sportKey || pick?.league));
}

export function selectScheduledHistoricalLeagues(leagues = []) {
  return [...new Set((Array.isArray(leagues) ? leagues : [])
    .filter(allowsScheduledHistoricalCapture))];
}
