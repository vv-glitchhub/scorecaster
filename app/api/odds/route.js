import { NextResponse } from "next/server";
import { getLeagueById, getLeaguesForSport } from "@/lib/league-options";
import {
  hasBettingOdds,
  normalizeOddsApiEvent,
  uniqueMatches,
} from "@/lib/odds-normalizer";

export const dynamic = "force-dynamic";

async function fetchTheOddsApiLeague(league, status = "upcoming") {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey || !league?.oddsApiSport) {
    return {
      ok: false,
      league: league?.id,
      sportKey: league?.oddsApiSport,
      error: "Missing ODDS_API_KEY or oddsApiSport",
      matches: [],
    };
  }

  const endpoint =
    status === "live"
      ? `https://api.the-odds-api.com/v4/sports/${league.oddsApiSport}/odds`
      : `https://api.the-odds-api.com/v4/sports/${league.oddsApiSport}/odds`;

  const url = new URL(endpoint);

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "eu,uk,us");
  url.searchParams.set("markets", "h2h,spreads,totals");
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
        league: league.id,
        sportKey: league.oddsApiSport,
        status: res.status,
        error: text,
        matches: [],
      };
    }

    let json;

    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        league: league.id,
        sportKey: league.oddsApiSport,
        error: "Invalid JSON from provider",
        raw: text,
        matches: [],
      };
    }

    const rawEvents = Array.isArray(json) ? json : [];

    const now = Date.now();

    const filteredEvents =
      status === "live"
        ? rawEvents.filter((event) => {
            const start = new Date(event.commence_time).getTime();
            const diffHours = (now - start) / (1000 * 60 * 60);

            return diffHours >= 0 && diffHours <= 5;
          })
        : rawEvents.filter((event) => {
            const start = new Date(event.commence_time).getTime();
            return start >= now;
          });

    const matches = filteredEvents
      .map((event) => ({
        ...normalizeOddsApiEvent(event, league.labelFi),
        isLive: status === "live",
      }))
      .filter(hasBettingOdds);

    return {
      ok: true,
      league: league.id,
      sportKey: league.oddsApiSport,
      requestedStatus: status,
      rawCount: rawEvents.length,
      filteredCount: filteredEvents.length,
      bettableCount: matches.length,
      matches,
    };
  } catch (error) {
    return {
      ok: false,
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
  const status = searchParams.get("status") || "upcoming";

  const leagues =
    leagueId !== "ALL"
      ? [getLeagueById(leagueId)].filter(Boolean)
      : getLeaguesForSport(sport).slice(0, 10);

  const results = await Promise.all(
    leagues.map((league) => fetchTheOddsApiLeague(league, status))
  );

  const matches = uniqueMatches(results.flatMap((result) => result.matches || []))
    .filter(hasBettingOdds)
    .sort(
      (a, b) =>
        new Date(a.commence_time || 0).getTime() -
        new Date(b.commence_time || 0).getTime()
    );

  return NextResponse.json({
    source: matches.length ? "live" : "empty",
    status: matches.length ? "fresh" : "empty",
    provider: "the-odds-api",
    cached: false,
    reason: matches.length
      ? ""
      : status === "live"
      ? "Live-tilassa ei löytynyt juuri nyt kertoimellisiä otteluita."
      : "The Odds API ei palauttanut kertoimellisiä tulevia otteluita.",
    matches,
    debug: {
      requestedSport: sport,
      requestedLeague: leagueId,
      requestedStatus: status,
      searchedLeagues: leagues.map((league) => ({
        id: league.id,
        oddsApiSport: league.oddsApiSport,
      })),
      hasOddsApiKey: Boolean(process.env.ODDS_API_KEY),
      results,
      bettableCount: matches.length,
    },
  });
}
