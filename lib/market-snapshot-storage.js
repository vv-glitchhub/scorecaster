const STORAGE_KEY = "scorecaster_market_change_snapshots_v1";
const MAX_SNAPSHOTS = 10;

function safeSnapshots(value) {
  return Array.isArray(value)
    ? value.filter((snapshot) => snapshot && Array.isArray(snapshot.picks) && snapshot.savedAt)
    : [];
}

export function getMarketSnapshots() {
  if (typeof window === "undefined") return [];

  try {
    return safeSnapshots(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function getLatestMarketSnapshot() {
  return getMarketSnapshots()[0] || null;
}

export function saveMarketSnapshot(snapshot) {
  if (typeof window === "undefined" || !snapshot) return [];

  const current = getMarketSnapshots();
  const next = [snapshot, ...current.filter((item) => item.savedAt !== snapshot.savedAt)]
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, MAX_SNAPSHOTS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return current;
  }

  return next;
}

export function clearMarketSnapshots() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The radar remains usable without persistent local storage.
  }
}

export { STORAGE_KEY, MAX_SNAPSHOTS };
