import { fetchNewsForMatch } from "./news-fetcher";
import { fetchInjuriesForMatch } from "./injury-fetcher";
import { fetchLineupForMatch } from "./lineup-fetcher";
import { fetchPolymarketForMatch } from "./polymarket-fetcher";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ITEMS = 100;
const cache = new Map();

function text(value, max = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cacheKey({ homeTeam, awayTeam, sport, league }) {
  return [homeTeam, awayTeam, sport, league].map((value) => text(value).toLowerCase()).join("::");
}

function trimCache() {
  if (cache.size <= MAX_CACHE_ITEMS) return;
  const oldest = [...cache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
  oldest.slice(0, cache.size - MAX_CACHE_ITEMS).forEach(([key]) => cache.delete(key));
}

export async function loadIntelligenceForMatch({ homeTeam, awayTeam, sport, league }) {
  const input = {
    homeTeam: text(homeTeam),
    awayTeam: text(awayTeam),
    sport: text(sport, 120),
    league: text(league, 120)
  };

  if (!input.homeTeam || !input.awayTeam || input.homeTeam.toLowerCase() === input.awayTeam.toLowerCase()) {
    return {
      ok: false,
      generatedAt: new Date().toISOString(),
      error: "Distinct home and away teams are required",
      news: { ok: true, mode: "invalid_input", data: [] },
      injuries: { ok: true, mode: "invalid_input", data: [] },
      lineup: { ok: true, mode: "invalid_input", data: {} },
      polymarket: { ok: true, mode: "invalid_input", data: [] }
    };
  }

  const key = cacheKey(input);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.createdAt <= CACHE_TTL_MS) return cached.value;

  const [news, injuries, lineup, polymarket] = await Promise.all([
    fetchNewsForMatch(input),
    fetchInjuriesForMatch(input),
    fetchLineupForMatch(input),
    fetchPolymarketForMatch(input)
  ]);

  const value = {
    ok: true,
    generatedAt: new Date().toISOString(),
    match: input,
    news,
    injuries,
    lineup,
    polymarket
  };
  cache.set(key, { createdAt: Date.now(), value });
  trimCache();
  return value;
}
