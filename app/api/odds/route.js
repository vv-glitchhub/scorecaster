import { NextResponse } from "next/server";
import { getLeagueById, getLeaguesForSport } from "@/lib/league-options";
import {
  hasBettingOdds,
  normalizeOddsApiEvent,
  uniqueMatches,
} from "@/lib/odds-normalizer";

export const dynamic = "force-dynamic";

const memoryCache = new Map();
const CACHE_MS = 1000 * 60 * 10;

function getCacheKey(params) {
  return JSON.stringify(params);
}

function getCached(key) {
  const item = memoryCache.get(key);
  if (!item) return null;

  if (Date.now() - item.createdAt > CACHE_MS) {
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

async function fetchTheOddsApiLeague(league) {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey || !league?.oddsApiSport) {
    return {
      ok: false,
      provider: "the-odds-api",
      league: league?.id,
      error: "Missing ODDS_API_KEY or oddsApiSport",
      matches: [],
    };
  }

  const url = new URL(
    `https://api.the-odds-api.com/v4/sports/${league.oddsApiSport}/odds`
  );

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "eu,uk,us");
  url.searchParams.set("markets", "h2h,totals,spreads");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return {
        ok: false,
        provider: "the-odds-api",
        league: league.id,
        sportKey: league.oddsApiSport,
        status: res.status,
        error: text,
        matches: [],
      };
    }

    const json = JSON.parse(text);

    if (!Array.isArray(json)) {
      return {
        ok: false,
        provider: "the-odds-api",
        league: league.id,
        sportKey: league.oddsApiSport,
        error: "Response was not an array",
        sample: json,
        matches: [],
      };
    }

    const matches = json
      .map((event) => normalizeOddsApiEvent(event, league.labelFi))
      .filter(hasBettingOdds);

    return {
      ok: true,
      provider: "the-odds-api",
      league: league.id,
      sportKey: league.oddsApiSport,
      rawCount: json.length,
      bettableCount: matches.length,
      matches,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "the-odds-api",
      league: league.id,
      sportKey: league.oddsApiSport,
      error: error.message,
      matches: [],
    };
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const sport = searchParams.get("sport") || "all";
  const leagueId = searchParams.get("league") || "ALL";
  const force = searchParams.get("force") === "1";

  const selectedLeagues =
    leagueId !== "ALL"
      ? [getLeagueById(leagueId)].filter(Boolean)
      : getLeaguesForSport(sport).slice(0, 10);

  const key = getCacheKey({
    sport,
    leagueId,
  });

  if (!force) {
    const cached = getCached(key);

    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }
  }

  const providerResults = await Promise.all(
    selectedLeagues.map((league) => fetchTheOddsApiLeague(league))
  );

  const matches = uniqueMatches(
    providerResults.flatMap((result) => result.matches || [])
  )
    .filter(hasBettingOdds)
    .sort((a, b) => new Date(a.commence_time || 0) - new Date(b.commence_time || 0));

  const payload = {
    source: matches.length ? "live" : "empty",
    status: matches.length ? "fresh" : "empty",
    provider: "the-odds-api",
    cached: false,
    cachedAt: Date.now(),
    reason: matches.length
      ? ""
      : "Valituista sarjoista ei löytynyt kertoimellisiä otteluita. Tarkista ODDS_API_KEY, krediitit ja valittu liiga.",
    matches,
    debug: {
      requestedSport: sport,
      requestedLeague: leagueId,
      searchedLeagues: selectedLeagues.map((league) => ({
        id: league.id,
        oddsApiSport: league.oddsApiSport,
      })),
      providerResults,
      hasOddsApiKey: Boolean(process.env.ODDS_API_KEY),
      bettableCount: matches.length,
    },
  };

  setCached(key, payload);

  return NextResponse.json(payload);
}
