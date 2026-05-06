import { NextResponse } from "next/server";
import { getLeagueById, getLeaguesForSport } from "@/lib/league-options";
import {
  hasBettingOdds,
  normalizeOddsApiEvent,
  uniqueMatches,
} from "@/lib/odds-normalizer";

export const dynamic = "force-dynamic";

async function fetchTheOddsApiLeague(league) {
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

  const url = new URL(
    `https://api.the-odds-api.com/v4/sports/${league.oddsApiSport}/odds`
  );

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "eu,uk,us");
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  const res = await fetch(url.toString(), { cache: "no-store" });
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

  const matches = Array.isArray(json)
    ? json.map((event) => normalizeOddsApiEvent(event, league.labelFi))
    : [];

  return {
    ok: true,
    league: league.id,
    sportKey: league.oddsApiSport,
    rawCount: Array.isArray(json) ? json.length : 0,
    bettableCount: matches.filter(hasBettingOdds).length,
    matches: matches.filter(hasBettingOdds),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const sport = searchParams.get("sport") || "all";
  const leagueId = searchParams.get("league") || "ALL";

  const leagues =
    leagueId !== "ALL"
      ? [getLeagueById(leagueId)].filter(Boolean)
      : getLeaguesForSport(sport).slice(0, 10);

  const results = await Promise.all(leagues.map(fetchTheOddsApiLeague));

  const matches = uniqueMatches(results.flatMap((r) => r.matches || []))
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
      : "The Odds API ei palauttanut kertoimellisiä otteluita. Katso debug: API-avain, sportKey, status ja error.",
    matches,
    debug: {
      requestedSport: sport,
      requestedLeague: leagueId,
      searchedLeagues: leagues.map((l) => ({
        id: l.id,
        oddsApiSport: l.oddsApiSport,
      })),
      hasOddsApiKey: Boolean(process.env.ODDS_API_KEY),
      results,
      bettableCount: matches.length,
    },
  });
}
