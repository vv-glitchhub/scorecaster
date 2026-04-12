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

function getEmptyBestOdds() {
  return {
    home: null,
    draw: null,
    away: null,
    bookmakerHome: null,
    bookmakerDraw: null,
    bookmakerAway: null,

    over: null,
    under: null,
    point: null,
    bookmakerOver: null,
    bookmakerUnder: null,

    spreadHome: null,
    spreadAway: null,
    spreadPointHome: null,
    spreadPointAway: null,
    bookmakerSpreadHome: null,
    bookmakerSpreadAway: null,
  };
}

function normalizeMatch(event, marketKey = "h2h") {
  const bookmakers = Array.isArray(event.bookmakers) ? event.bookmakers : [];
  const bestOdds = getEmptyBestOdds();

  for (const bookmaker of bookmakers) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== marketKey) continue;

      for (const outcome of market.outcomes || []) {
        if (marketKey === "h2h") {
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

        if (marketKey === "totals") {
          const price = toNumber(outcome.price);
          const point = toNumber(outcome.point);

          if (String(outcome.name).toLowerCase() === "over") {
            if (price && (!bestOdds.over || price > bestOdds.over)) {
              bestOdds.over = price;
              bestOdds.point = point;
              bestOdds.bookmakerOver = bookmaker.title;
            }
          }

          if (String(outcome.name).toLowerCase() === "under") {
            if (price && (!bestOdds.under || price > bestOdds.under)) {
              bestOdds.under = price;
              bestOdds.point = point;
              bestOdds.bookmakerUnder = bookmaker.title;
            }
          }
        }

        if (marketKey === "spreads") {
          const price = toNumber(outcome.price);
          const point = toNumber(outcome.point);

          if (outcome.name === event.home_team) {
            if (price && (!bestOdds.spreadHome || price > bestOdds.spreadHome)) {
              bestOdds.spreadHome = price;
              bestOdds.spreadPointHome = point;
              bestOdds.bookmakerSpreadHome = bookmaker.title;
            }
          }

          if (outcome.name === event.away_team) {
            if (price && (!bestOdds.spreadAway || price > bestOdds.spreadAway)) {
              bestOdds.spreadAway = price;
              bestOdds.spreadPointAway = point;
              bestOdds.bookmakerSpreadAway = bookmaker.title;
            }
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
    marketKey,
  };
}

function fallbackOdds({ sport, market }) {
  const now = Date.now();

  const baseMatches = [
    {
      id: `${sport || "demo"}-1`,
      sport_key: sport || "icehockey_liiga",
      sport_title: "Liiga",
      commence_time: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      home_team: "Tappara",
      away_team: "Ilves",
      bookmakers: [],
    },
    {
      id: `${sport || "demo"}-2`,
      sport_key: "soccer_epl",
      sport_title: "Premier League",
      commence_time: new Date(now + 5 * 60 * 60 * 1000).toISOString(),
      home_team: "Arsenal",
      away_team: "Liverpool",
      bookmakers: [],
    },
  ];

  const matches = baseMatches.map((match, index) => {
    const bestOdds = getEmptyBestOdds();

    if (market === "h2h") {
      if (index === 0) {
        bestOdds.home = 2.1;
        bestOdds.draw = 4.0;
        bestOdds.away = 2.7;
      } else {
        bestOdds.home = 2.55;
        bestOdds.draw = 3.6;
        bestOdds.away = 2.8;
      }
      bestOdds.bookmakerHome = "DemoBook";
      bestOdds.bookmakerDraw = "DemoBook";
      bestOdds.bookmakerAway = "DemoBook";
    }

    if (market === "totals") {
      bestOdds.over = index === 0 ? 1.91 : 1.95;
      bestOdds.under = index === 0 ? 1.93 : 1.9;
      bestOdds.point = index === 0 ? 5.5 : 2.5;
      bestOdds.bookmakerOver = "DemoBook";
      bestOdds.bookmakerUnder = "DemoBook";
    }

    if (market === "spreads") {
      bestOdds.spreadHome = index === 0 ? 1.9 : 1.94;
      bestOdds.spreadAway = index === 0 ? 1.92 : 1.96;
      bestOdds.spreadPointHome = index === 0 ? -1.5 : -0.5;
      bestOdds.spreadPointAway = index === 0 ? +1.5 : +0.5;
      bestOdds.bookmakerSpreadHome = "DemoBook";
      bestOdds.bookmakerSpreadAway = "DemoBook";
    }

    return {
      ...match,
      bestOdds,
      marketKey: market,
    };
  });

  return {
    source: "fallback",
    cached: false,
    market,
    region: DEFAULT_REGION,
    matches,
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
    const fallback = fallbackOdds({ sport, market });
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
    const fallback = fallbackOdds({ sport, market });
    return setCachedValue(cacheKey, fallback, ttlMs);
  }

  if (!response.ok) {
    const fallback = fallbackOdds({ sport, market });
    return setCachedValue(cacheKey, fallback, ttlMs);
  }

  const raw = await response.json();

  if (!Array.isArray(raw)) {
    const fallback = fallbackOdds({ sport, market });
    return setCachedValue(cacheKey, fallback, ttlMs);
  }

  const normalizedMatches = raw
    .map((event) => normalizeMatch(event, market))
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
