import { buildHistoricalOddsSnapshot } from "./historical-odds-engine";

const STORAGE_KEY = "scorecaster_historical_odds_v1";
const MAX_SNAPSHOTS = 1000;

export function getHistoricalOddsStorageKey() {
  return STORAGE_KEY;
}

export function loadHistoricalOdds() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoricalOdds(snapshots = []) {
  if (typeof window === "undefined") return [];

  const clean = Array.isArray(snapshots) ? snapshots.slice(-MAX_SNAPSHOTS) : [];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

export function addHistoricalOddsSnapshot(snapshot) {
  const current = loadHistoricalOdds();
  const next = [...current, snapshot]
    .filter(Boolean)
    .slice(-MAX_SNAPSHOTS);

  return saveHistoricalOdds(next);
}

export function captureHistoricalOddsFromPick(pick = {}) {
  const snapshot = buildHistoricalOddsSnapshot({
    gameId: pick.gameId,
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    league: pick.league || pick.leagueTitle,
    marketKey: pick.marketKey || "h2h",
    bookmaker: pick.bookmaker,
    selection: pick.selection,
    odds: pick.odds
  });

  return addHistoricalOddsSnapshot(snapshot);
}

export function clearHistoricalOdds() {
  if (typeof window === "undefined") return [];
  window.localStorage.removeItem(STORAGE_KEY);
  return [];
}
