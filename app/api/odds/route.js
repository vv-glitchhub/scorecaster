import { NextResponse } from "next/server";
import { normalizeOddsApiEvent, hasBettableOdds } from "@/lib/odds-normalizer";

export const dynamic = "force-dynamic";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4/sports";

const SPORT_KEYS = {
  icehockey: { NHL: "icehockey_nhl", LIIGA: "icehockey_liiga" },
  soccer: { EPL: "soccer_epl", UCL: "soccer_uefa_champs_league" },
  basketball: { NBA: "basketball_nba" },
  americanfootball: { NFL: "americanfootball_nfl" },
  baseball: { MLB: "baseball_mlb" },
  tennis: { ATP: "tennis_atp", WTA: "tennis_wta" },
  mma: { UFC: "mma_mixed_martial_arts" },
};

function demoMatches() {
  const now = Date.now();

  return [
    demoMatch("demo-1", "NHL", "icehockey_nhl", "Buffalo Sabres", "Montreal Canadiens", now + 3600000),
    demoMatch("demo-2", "Liiga", "icehockey_liiga", "Tappara", "Ilves", now + 7200000),
    demoMatch("demo-3", "Premier League", "soccer_epl", "Arsenal", "Liverpool", now + 10800000),
  ];
}

function demoMatch(id, sportTitle, sportKey, home, away, time) {
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
      home: 2.1,
      draw: 3.8,
      away: 2.9,
      over: 1.9,
      under: 1.95,
      point: sportKey.includes("soccer") ? 2.5 : 5.5,
      spreadHome: 1.9,
      spreadAway: 1.9,
      spreadPointHome: -1.5,
      spreadPointAway: 1.5,
      books: {
        home: "Coolbet",
        draw: "Paf",
        away: "Unibet",
        over: "Coolbet",
        under: "Paf",
        spreadHome: "Unibet",
        spreadAway: "Coolbet",
      },
      bookPrices: {
        home: [{ bookmaker: "Coolbet", odds: 2.1 }],
        draw: [{ bookmaker: "Paf", odds: 3.8 }],
        away: [{ bookmaker: "Unibet", odds: 2.9 }],
        over: [{ bookmaker: "Coolbet", odds: 1.9 }],
        under: [{ bookmaker: "Paf", odds: 1.95 }],
        spreadHome: [{ bookmaker: "Unibet", odds: 1.9 }],
        spreadAway: [{ bookmaker: "Coolbet", odds: 1.9 }],
      },
    },
  };
}

function getSportKeys(sport, league) {
  const safeSport = sport === "all" ? "icehockey" : sport;
  const group = SPORT_KEYS[safeSport] || SPORT_KEYS.icehockey;

  if (league && league !== "ALL") {
    return [group[league] || Object.values(group)[0]];
  }

  return Object.values(group);
}

async function fetchSportKey(sportKey, apiKey) {
  try {
    const url = new URL(`${ODDS_API_BASE}/${sportKey}/odds`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", "eu,us");
    url.searchParams.set("markets", "h2h,totals,spreads");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");

    const res = await fetch(url.toString(), { cache: "no-store" });
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
      error: error.message,
      matches: [],
    };
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const sport = searchParams.get("sport") || "icehockey";
    const league = searchParams.get("league") || "NHL";
    const status = searchParams.get("status") || "upcoming";

    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        source: "fallback",
        status: "demo",
        provider: "local-demo",
        reason: "ODDS_API_KEY puuttuu. Näytetään demo-data.",
        matches: demoMatches(),
        debug: { sport, league, status, hasOddsApiKey: false },
      });
    }

    const sportKeys = getSportKeys(sport, league);
    const results = [];

    for (const sportKey of sportKeys) {
      results.push(await fetchSportKey(sportKey, apiKey));
    }

    const matches = results.flatMap((r) => r.matches || []);

    if (matches.length > 0) {
      return NextResponse.json({
        source: "live",
        status: "fresh",
        provider: "the-odds-api",
        cached: false,
        reason: "",
        matches,
        debug: { sport, league, status, results, bettableCount: matches.length },
      });
    }

    return NextResponse.json({
      source: "fallback",
      status: "demo",
      provider: "local-demo",
      cached: false,
      reason: "Live-kerroindata ei ole saatavilla. Näytetään demo-data.",
      matches: demoMatches(),
      debug: { sport, league, status, results, bettableCount: 0 },
    });
  } catch (error) {
    return NextResponse.json(
      {
        source: "fallback",
        status: "demo",
        provider: "local-demo",
        cached: false,
        reason: "API route error. Näytetään demo-data.",
        matches: demoMatches(),
        debug: { error: error.message },
      },
      { status: 200 }
    );
  }
}
