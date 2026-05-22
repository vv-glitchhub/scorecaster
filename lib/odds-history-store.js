const STORAGE_KEY = "scorecaster_odds_history_v1";
const MAX_ITEMS_PER_MATCH = 50;

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getStore() {
  if (typeof window === "undefined") return {};

  const raw = window.localStorage.getItem(STORAGE_KEY);
  return safeJsonParse(raw, {});
}

function saveStore(store) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store || {}));
  } catch {
    // ignore localStorage errors
  }
}

function getBestOddsSnapshot(match) {
  const best = match?.bestOdds || {};

  return {
    time: Date.now(),
    home: Number(best.home || 0),
    away: Number(best.away || 0),
    draw: Number(best.draw || 0),
    over: Number(best.over || 0),
    under: Number(best.under || 0),
    spreadHome: Number(best.spreadHome || 0),
    spreadAway: Number(best.spreadAway || 0),
  };
}

export function addOddsSnapshots(matches = []) {
  if (!Array.isArray(matches)) return;

  const store = getStore();

  for (const match of matches) {
    if (!match?.id) continue;

    const id = String(match.id);

    if (!Array.isArray(store[id])) {
      store[id] = [];
    }

    store[id].push(getBestOddsSnapshot(match));

    if (store[id].length > MAX_ITEMS_PER_MATCH) {
      store[id] = store[id].slice(-MAX_ITEMS_PER_MATCH);
    }
  }

  saveStore(store);
}

export function getOddsHistory(match) {
  if (!match?.id) return [];

  const store = getStore();
  const history = store[String(match.id)];

  return Array.isArray(history) ? history : [];
}

export function getOddsMovement(match, key = "home") {
  const history = getOddsHistory(match);

  if (history.length < 2) {
    return {
      direction: "flat",
      change: 0,
      from: null,
      to: null,
      history,
    };
  }

  const first = history[0];
  const last = history[history.length - 1];

  const from = Number(first?.[key] || 0);
  const to = Number(last?.[key] || 0);
  const change = to - from;

  return {
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    change,
    from,
    to,
    history,
  };
}

export function clearOddsHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
