"use client";

const STORAGE_KEY = "scorecaster_odds_history_v1";
const MAX_SNAPSHOTS_PER_MATCH = 20;

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function getOddsHistory() {
  if (typeof window === "undefined") return {};
  return safeParse(localStorage.getItem(STORAGE_KEY), {});
}

export function saveOddsHistory(history) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearOddsHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function createOddsSnapshot(match) {
  return {
    at: Date.now(),
    matchId: match.id,
    home_team: match.home_team,
    away_team: match.away_team,
    commence_time: match.commence_time,
    bestOdds: match.bestOdds || {},
  };
}

export function addOddsSnapshots(matches = []) {
  const history = getOddsHistory();

  for (const match of matches) {
    if (!match?.id || !match?.bestOdds) continue;

    const snapshot = createOddsSnapshot(match);
    const current = Array.isArray(history[match.id]) ? history[match.id] : [];

    history[match.id] = [...current, snapshot].slice(-MAX_SNAPSHOTS_PER_MATCH);
  }

  saveOddsHistory(history);
  return history;
}

export function getMatchHistory(matchId) {
  const history = getOddsHistory();
  return Array.isArray(history[matchId]) ? history[matchId] : [];
}

export function getOddsMovement(match, key) {
  if (!match?.id || !key) return null;

  const history = getMatchHistory(match.id);
  if (history.length < 2) return null;

  const first = history[0]?.bestOdds?.[key];
  const latest = history[history.length - 1]?.bestOdds?.[key];

  if (!first || !latest) return null;

  const change = Number(latest) - Number(first);
  const changePct = first ? change / Number(first) : 0;

  return {
    first: Number(first),
    latest: Number(latest),
    change,
    changePct,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    snapshots: history.length,
  };
}

export function getAllMovements(match) {
  if (!match) return {};

  return {
    home: getOddsMovement(match, "home"),
    draw: getOddsMovement(match, "draw"),
    away: getOddsMovement(match, "away"),
    over: getOddsMovement(match, "over"),
    under: getOddsMovement(match, "under"),
    spreadHome: getOddsMovement(match, "spreadHome"),
    spreadAway: getOddsMovement(match, "spreadAway"),
  };
}
