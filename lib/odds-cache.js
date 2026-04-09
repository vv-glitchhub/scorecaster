const globalForOddsCache = globalThis;

if (!globalForOddsCache.__scorecasterOddsCache) {
  globalForOddsCache.__scorecasterOddsCache = new Map();
}

const oddsCache = globalForOddsCache.__scorecasterOddsCache;

export function getOddsCache(key) {
  const item = oddsCache.get(key);
  if (!item) return null;

  const now = Date.now();
  if (item.expiresAt && item.expiresAt < now) {
    oddsCache.delete(key);
    return null;
  }

  return item.value ?? null;
}

export function setOddsCache(key, value, ttlSeconds = 600) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  oddsCache.set(key, {
    value,
    expiresAt,
    createdAt: Date.now(),
  });
}

export function clearExpiredOddsCache() {
  const now = Date.now();

  for (const [key, item] of oddsCache.entries()) {
    if (!item?.expiresAt || item.expiresAt < now) {
      oddsCache.delete(key);
    }
  }
}

export function getOddsCacheMeta(key) {
  const item = oddsCache.get(key);
  if (!item) return null;

  return {
    createdAt: item.createdAt ?? null,
    expiresAt: item.expiresAt ?? null,
  };
}
