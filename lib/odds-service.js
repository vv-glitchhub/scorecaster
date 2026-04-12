import {
  buildOddsCacheKey,
  getCachedValue,
  setCachedValue,
} from "@/lib/odds-cache";

const API_BASE = "https://api.the-odds-api.com/v4";
const DEFAULT_REGION = "eu";
const DEFAULT_MARKET = "h2h";
const DEFAULT_TTL_MS = 60_000;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeMatch(event) {
  const bookmakers = Array.isArray(event.bookmakers) ? event.bookmakers : [];

  const bestOdds = {
    home: null,
    draw: null,
    away: null,
    bookmakerHome: null,
    bookmakerDraw: null,
    bookmakerAway: null,
  };

  for (const bookmaker of bookmakers) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        if (outcome.name === event.home_team) {
          const price = toNumber(outcome.price);
          if (price && (!bestOdds.home || price > bestOdds.home)) {
            bestOdds.home = price;
            bestOdds.bookmakerHome = bookmaker.title;
          }
        }

        if (outcome.name === event.away_team) {
          const price = toNumber(outcome.price);
          if (price && (!bestOdds.away || price > bestOdds.away)) {
            bestOdds.away = price;
            bestOdds.bookmakerAway = bookmaker.title;
          }
        }

        if (String(outcome.name).toLowerCase() === "draw") {
          const price = toNumber(outcome.price);
          if (price && (!bestOdds.draw || price > bestOdds.draw)) {
            bestOdds.draw = price;
            bestOdds.bookmakerDraw = bookmaker.title;
          }
        }
      }
    }
  }

  return {
    id: event.id,
    sport_key: event.sport_key,
    sport_title: event.sport_title,
    commence_time: event.commence_time,
    home_team: event.home_team,
    away_team: event.away_team,
    bookmakers,
    bestOdds,
  };
}

function fallbackOdds({ sport }) {
  const now = Date.now();

  return {
    source: "fallback",
    cached: false,
    market: DEFAULT_MARKET,
    region: DEFAULT_REGION,
    matches: [
      {
        id: `${sport || "demo"}-1`,
        sport_key: sport || "icehockey_liiga",
        sport_title: "Liiga",
        commence_time: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        home_team: "Tappara",
        away_team: "Ilves",
        bookmakers: [],
        bestOdds: {
          home: 2.1,
          draw: 4.0,
          away: 2.7,
          bookmakerHome: "DemoBook",
          bookmakerDraw: "DemoBook",
          bookmakerAway: "DemoBook",
        },
      },
      {
        id: `${sport || "demo"}-2`,
        sport_key: "soccer_epl",
        sport_title: "Premier League",
        commence_time: new Date(now + 5 * 60 * 60 * 1000).toISOString(),
        home_team: "Arsenal",
        away_team: "Liverpool",
        bookmakers: [],
        bestOdds: {
          home: 2.55,
          draw: 3.6,
          away: 2.8,
          bookmakerHome: "DemoBook",
          bookmakerDraw: "DemoBook",
          bookmakerAway: "DemoBook",
        },
      },
    ],
  };
}

export async function getOddsData({
  sport,
  league,
  market = DEFAULT_MARKET,
  region = DEFAULT_REGION,
  forceRefresh = false,
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  const cacheKey = buildOddsCacheKey({ sport, league, market, region });

  if (!forceRefresh) {
    const cached = getCachedValue(cacheKey);
    if (cached) {
      return {
        ...cached,
        cached: true,
      };
    }
  }

  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey || !sport) {
    const fallback = fallbackOdds({ sport });
    return setCachedValue(cacheKey, fallback, ttlMs);
  }

  const url = new URL(`${API_BASE}/sports/${sport}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", region);
  url.searchParams.set("markets", market);
  url.searchParams.set("oddsFormat", "decimal");

  let response;

  try {
    response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });
  } catch {
    const fallback = fallbackOdds({ sport });
    return setCachedValue(cacheKey, fallback, ttlMs);
  }

  if (!response.ok) {
    const fallback = fallbackOdds({ sport });
    return setCachedValue(cacheKey, fallback, ttlMs);
  }

  const raw = await response.json();

  if (!Array.isArray(raw)) {
    const fallback = fallbackOdds({ sport });
    return setCachedValue(cacheKey, fallback, ttlMs);
  }

  const normalizedMatches = raw
    .map(normalizeMatch)
    .filter((match) => {
      if (!league) return true;
      return match.sport_title === league || match.sport_key === league;
    });

  const payload = {
    source: "api",
    cached: false,
    market,
    region,
    matches: normalizedMatches,
  };

  return setCachedValue(cacheKey, payload, ttlMs);
}
