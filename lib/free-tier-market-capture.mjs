import { OWNED_FOOTBALL_LEAGUES } from "./active-market-universe.js";

// Free-tier policy applies ONLY to durable market-history writes. Live Top Picks,
// all event discovery, best-odds lookup and the independent model are unchanged.
// There is no autonomous deletion of historical evidence.
export const FREE_TIER_MARKET_CAPTURE_BUDGET = Object.freeze({
  maxEventsPerCycle: 12,
  maxEventsPerLeague: 2,
  maxBookmakersPerEvent: 4
});

const OWNED = new Set(OWNED_FOOTBALL_LEAGUES);
const boundedInteger = (value, maximum) =>
  Number.isInteger(value) ? Math.min(maximum, Math.max(0, value)) : 0;

function orderedUpcoming(games, nowMs) {
  const seen = new Set();
  return (Array.isArray(games) ? games : [])
    .filter((game) => {
      const id = String(game?.id ?? game?.gameId ?? game?.eventId ?? "").trim();
      const start = Date.parse(game?.commence_time ?? game?.commenceTime ?? "");
      if (!id || !Number.isFinite(start) || start <= nowMs || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => Date.parse(a.commence_time ?? a.commenceTime) - Date.parse(b.commence_time ?? b.commenceTime));
}

export function selectFreeTierMarketCapture(groups = [], {
  now = new Date(),
  budget = FREE_TIER_MARKET_CAPTURE_BUDGET
} = {}) {
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new TypeError("A valid capture time is required");
  const maxEvents = boundedInteger(budget.maxEventsPerCycle, 36);
  const perLeague = boundedInteger(budget.maxEventsPerLeague, 6);
  const maxBookmakers = boundedInteger(budget.maxBookmakersPerEvent, 12);
  const availableGroups = (Array.isArray(groups) ? groups : [])
    .map((group) => ({
      sport: String(group?.sport ?? ""),
      games: orderedUpcoming(group?.games, nowMs)
    }))
    .filter((group) => group.sport);
  const owned = availableGroups.filter((group) => OWNED.has(group.sport));
  const other = availableGroups.filter((group) => !OWNED.has(group.sport));
  // Rotate the scarce non-owned slots per capture hour. This prevents a fixed
  // order from permanently excluding e.g. NHL in favor of NFL and NBA.
  const offset = other.length ? Math.floor(nowMs / 3_600_000) % other.length : 0;
  const rotatedOther = [...other.slice(offset), ...other.slice(0, offset)];
  const chosen = new Map(availableGroups.map((group) => [group.sport, []]));
  const seenEvents = new Set();
  let selected = 0;

  const take = (group) => {
    const target = chosen.get(group.sport);
    for (const game of group.games) {
      if (selected >= maxEvents || target.length >= perLeague) break;
      const id = String(game.id ?? game.gameId ?? game.eventId);
      const key = group.sport + "|" + id;
      if (seenEvents.has(key)) continue;
      const bookmakers = Array.isArray(game.bookmakers) ? game.bookmakers.slice(0, maxBookmakers) : [];
      if (!bookmakers.length) continue;
      target.push({ ...game, bookmakers });
      seenEvents.add(key);
      selected++;
    }
  };

  for (const group of owned) take(group);
  for (const group of rotatedOther) take(group);
  return {
    version: "scorecaster-free-tier-market-capture-v1",
    selectedBySport: chosen,
    selectedEvents: selected,
    eligibleEvents: availableGroups.reduce((n, g) => n + g.games.length, 0),
    bookmakerCap: maxBookmakers,
    budget: { maxEventsPerCycle: maxEvents, maxEventsPerLeague: perLeague },
    storageOnly: true,
    rawPayloadStored: false,
    historicalDataDeleted: false
  };
}
