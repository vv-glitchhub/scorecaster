import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let cachedData = null;
let cachedAt = 0;

const CACHE_MS = 10 * 60 * 1000;

const DEMO_DATA = {
  source: "fallback",
  status: "demo",
  reason:
    "Live-dataa ei saatu ladattua tai API-creditit ovat loppu. Näytetään testidata.",
  matches: [
    {
      id: "demo-liiga-1",
      sport_key: "icehockey_liiga",
      sport_title: "Liiga",
      home_team: "Tappara",
      away_team: "Ilves",
      bestOdds: {
        home: 2.1,
        draw: 4.2,
        away: 2.75,
        point: 5.5,
        over: 1.9,
        under: 1.92,
        spreadPointHome: -1.5,
        spreadPointAway: 1.5,
        spreadHome: 2.45,
        spreadAway: 1.55,
      },
    },
    {
      id: "demo-liiga-2",
      sport_key: "icehockey_liiga",
      sport_title: "Liiga",
      home_team: "Lukko",
      away_team: "TPS",
      bestOdds: {
        home: 1.85,
        draw: 4.4,
        away: 3.25,
        point: 5.5,
        over: 1.88,
        under: 1.95,
        spreadPointHome: -1.5,
        spreadPointAway: 1.5,
        spreadHome: 2.2,
        spreadAway: 1.7,
      },
    },
  ],
};

function normalizeMatch(event) {
  const bookmakers = Array.isArray(event?.bookmakers) ? event.bookmakers : [];

  let bestHome = null;
  let bestDraw = null;
  let bestAway = null;

  for (const bookmaker of bookmakers) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== "h2h") continue;

      for (const outcome of market.outcomes || []) {
        const price = Number(outcome.price);
        if (!Number.isFinite(price)) continue;

        if (outcome.name === event.home_team) {
          bestHome = bestHome == null ? price : Math.max(bestHome, price);
        }

        if (outcome.name === event.away_team) {
          bestAway = bestAway == null ? price : Math.max(bestAway, price);
        }

        if (outcome.name?.toLowerCase() === "draw") {
          bestDraw = bestDraw == null ? price : Math.max(bestDraw, price);
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
    bestOdds: {
      home: bestHome,
      draw: bestDraw,
      away: bestAway,
    },
  };
}

export async function GET() {
  const now = Date.now();

  if (cachedData && now - cachedAt < CACHE_MS) {
    return NextResponse.json({
      ...cachedData,
      cached: true,
      cacheAgeSeconds: Math.round((now - cachedAt) / 1000),
    });
  }

  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      ...DEMO_DATA,
      reason: "ODDS_API_KEY puuttuu Vercel Environment Variables -asetuksista.",
    });
  }

  try {
    const url =
      "https://api.the-odds-api.com/v4/sports/icehockey_liiga/odds/" +
      `?apiKey=${apiKey}` +
      "&regions=eu" +
      "&markets=h2h" +
      "&oddsFormat=decimal";

    const response = await fetch(url, {
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json({
        ...DEMO_DATA,
        source: "fallback",
        status: "api_error",
        reason: `Odds API error ${response.status}: ${text}`,
      });
    }

    const raw = JSON.parse(text);

    const matches = Array.isArray(raw)
      ? raw.map(normalizeMatch).filter(Boolean)
      : [];

    if (matches.length === 0) {
      return NextResponse.json({
        ...DEMO_DATA,
        source: "fallback",
        status: "empty",
        reason:
          "Odds API vastasi, mutta pelejä ei löytynyt tälle sport keylle juuri nyt.",
      });
    }

    cachedData = {
      source: "live",
      status: "fresh",
      cached: false,
      reason: "",
      matches,
    };

    cachedAt = now;

    return NextResponse.json(cachedData);
  } catch (error) {
    return NextResponse.json({
      ...DEMO_DATA,
      source: "fallback",
      status: "error",
      reason: `Live-datan haku epäonnistui: ${error.message}`,
    });
  }
}
