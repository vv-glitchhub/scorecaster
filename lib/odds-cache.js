const GLOBAL_KEY = "__scorecaster_odds_cache__";

function getStore() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = new Map();
  }
  return globalThis[GLOBAL_KEY];
}

export function getCachedValue(key) {
  const store = getStore();
  const item = store.get(key);

  if (!item) return null;

  if (item.expiresAt && Date.now() > item.expiresAt) {
    store.delete(key);
    return null;
  }

  return item.value;
}

export function setCachedValue(key, value, ttlMs = 60_000) {
  const store = getStore();

  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

export function clearCachedValue(key) {
  getStore().delete(key);
}

export function buildOddsCacheKey({
  sport,
  league,
  market = "h2h",
  region = "eu",
}) {
  return [sport || "all", league || "all", market, region].join(":");
}
