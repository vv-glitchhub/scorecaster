import { OWNED_FOOTBALL_LEAGUES } from "./active-market-universe.js";

// A write budget is not a display filter. Keep full live market discovery
// independent from the number of long-lived database snapshots.
const OWNED = new Set(OWNED_FOOTBALL_LEAGUES);
export const CAPTURE_BUDGET = Object.freeze({
  total: 18,
  ownedFootball: 12,
  other: 6
});

function keyOf(pick) {
  return [pick?.eventId || pick?.gameId || pick?.id, pick?.marketKey, pick?.selection, pick?.point ?? ""].join("|");
}

export function selectCapturePicks(picks = [], budget = CAPTURE_BUDGET) {
  const input = Array.isArray(picks) ? picks : [];
  const maxTotal = Math.max(0, Math.min(36, Math.trunc(Number(budget.total) || 0)));
  const maxOwned = Math.max(0, Math.min(maxTotal, Math.trunc(Number(budget.ownedFootball) || 0)));
  const maxOther = Math.max(0, Math.min(maxTotal, Math.trunc(Number(budget.other) || 0)));
  const seen = new Set();
  const unique = input.filter((pick) => {
    if (!pick || typeof pick !== "object") return false;
    const key = keyOf(pick);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const owned = unique.filter((pick) => OWNED.has(String(pick.league || pick.sportKey || "")));
  const other = unique.filter((pick) => !OWNED.has(String(pick.league || pick.sportKey || "")));
  // Retain the route's ranked order inside each group. Non-owned leagues
  // cannot crowd out the European football evidence budget.
  const selected = [...owned.slice(0, maxOwned), ...other.slice(0, maxOther)];
  // Only European owned football may use unused write capacity. A busy MLS
  // schedule must never consume more than the non-core quota.
  if (selected.length < maxTotal) {
    const selectedKeys = new Set(selected.map(keyOf));
    for (const pick of owned.slice(maxOwned)) {
      if (selected.length >= maxTotal) break;
      if (!selectedKeys.has(keyOf(pick))) {
        selected.push(pick);
        selectedKeys.add(keyOf(pick));
      }
    }
  }
  return selected;
}
