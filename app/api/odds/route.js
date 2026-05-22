import { NextResponse } from "next/server";
import { getOddsApiSports } from "@/lib/sports-config";
import { normalizeOddsApiEvent, hasBettableOdds } from "@/lib/odds-normalizer";

export const dynamic = "force-dynamic";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4/sports";
const CACHE_TTL_MS = 60 * 1000;
const memoryCache = new Map();

function cacheKeyFrom({ sport, league, status }) {
  return `${sport}:${league}:${status}`;
}

function getCached(key) {
  const item = memoryCache.get(key);
  if (!item) return null;

  if (Date.now() - item.createdAt > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }

  return item.data;
}

function setCached(key, data) {
  memoryCache.set(key, {
    createdAt: Date.now(),
    data,
  });
}

function demoMatches() {
  const now = Date.now();

  return [
    demoMatch("demo-nhl-1", "NHL", "icehockey_nhl", "Colorado Avalanche", "Vegas Golden Knights", now + 3600000, 1.91, 3.65),
    demoMatch("demo-liiga-1", "Liiga", "icehockey_liiga", "Tappara", "Ilves", now + 7200000, 2.15, 2.95),
    demoMatch("demo-epl-1", "Premier League", "soccer_epl", "Arsenal", "Liverpool", now + 10800000, 2.42, 2.9),
    demoMatch("demo-nba-1", "NBA", "basketball_nba", "Boston Celtics", "Miami Heat", now + 14400000, 1.7, 2.25),
  ];
}

function demoMatch(id, sportTitle, sportKey, home, away, time, homeOdds, awayOdds) {
  return {
    id,
    source: "demo",
    sport_key: sportKey,
    sport_title: sportTitle,
    commence_time: new Date(time).toISOString(),
    home_team: home,
    away_team: away,
    event_type: "matchup",
    bestOdds: {
      home: homeOdds,
      draw: sportKey.includes("soccer") || sportKey.includes("icehockey") ? 3.8 : null,
      away: awayOdds,
      over: 1.9,
      under: 1.95,
      point: sportKey.includes("soccer") ? 2.5 : sportKey.includes("basketball") ? 218.5 : 5.5,
      spreadHome: 1.91,
      spreadAway: 1.91,
      spreadPointHome: -1.5,
      spreadPointAway: 1.5,
      books: {
        home: "DemoBook",
        draw: "DemoBook",
        away: "DemoBook",
        over: "DemoBook",
        under: "DemoBook",
        spreadHome: "DemoBook",
        spreadAway: "DemoBook",
      },
      bookPrices: {
        home: [{ bookmaker: "DemoBook", odds: homeOdds }],
        away: [{ bookmaker: "DemoBook", odds: awayOdds }],
      },
    },
  };
}

async function fetchSportKey(sportKey, apiKey) {
  try {
    const url = new URL(`${ODDS_API_BASE}/${sportKey}/odds`);

    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", "eu,us");
    url.searchParams.set("markets", "h2h,totals,spreads");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");

    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return {
        ok: false,
        sportKey,
        status: res.status,
        error: text,
        matches: [],
      };
    }

    let json = [];

    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        sportKey,
        status: res.status,
        error: "Invalid JSON",
        matches: [],
      };
    }

    const matches = Array.isArray(json)
      ? json.map(normalizeOddsApiEvent).filter(hasBettableOdds)
      : [];

    return {
      ok: true,
      sportKey,
      status: res.status,
      rawCount: Array.isArray(json) ? json.length : 0,
      matches,
    };
  } catch (error) {
    return {
      ok: false,
      sportKey,
      status: 500,
      error: error?.message || "Unknown fetch error",
      matches: [],
    };
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const sport = searchParams.get("sport") || "all";
    const league = searchParams.get("league") || "ALL";
    const status = searchParams.get("status") || "upcoming";
    const force = searchParams.get("force") === "1";

    const apiKey = process.env.ODDS_API_KEY;
    const key = cacheKeyFrom({ sport, league, status });

    if (!force) {
      const cached = getCached(key);

      if (cached) {
        return NextResponse.json({
          ...cached,
          cached: true,
        });
      }
    }

    if (!apiKey) {
      const fallback = {
        source: "fallback",
        status: "demo",
        provider: "local-demo",
        cached: false,
        reason: "ODDS_API_KEY puuttuu. Näytetään demo-data.",
        matches: demoMatches(),
        debug: { sport, league, status, hasOddsApiKey: false },
      };

      setCached(key, fallback);
      return NextResponse.json(fallback);
    }

    let sportKeys = getOddsApiSports(sport, league);

    if (sport === "all") {
      sportKeys = sportKeys.slice(0, 8);
    }

    const results = [];

    for (const sportKey of sportKeys) {
      results.push(await fetchSportKey(sportKey, apiKey));
    }

    const matches = results
      .flatMap((result) => result.matches || [])
      .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));

    if (matches.length > 0) {
      const response = {
        source: "live",
        status: "fresh",
        provider: "the-odds-api",
        cached: false,
        reason: "",
        matches,
        debug: {
          sport,
          league,
          status,
          searchedSports: sportKeys,
          results,
          bettableCount: matches.length,
        },
      };

      setCached(key, response);
      return NextResponse.json(response);
    }

    const fallback = {
      source: "fallback",
      status: "demo",
      provider: "local-demo",
      cached: false,
      reason: "Live-dataa ei löytynyt. Näytetään demo-data.",
      matches: demoMatches(),
      debug: {
        sport,
        league,
        status,
        searchedSports: sportKeys,
        results,
        bettableCount: 0,
      },
    };

    setCached(key, fallback);
    return NextResponse.json(fallback);
  } catch (error) {
    return NextResponse.json(
      {
        source: "fallback",
        status: "demo",
        provider: "local-demo",
        cached: false,
        reason: "API route error. Näytetään demo-data.",
        matches: demoMatches(),
        debug: { error: error?.message || "Unknown route error" },
      },
      { status: 200 }
    );
  }
}
