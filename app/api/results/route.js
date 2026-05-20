import { NextResponse } from "next/server";
import { getSportsDbLeagueId } from "@/lib/results-league-map";
import { normalizeSportsDbEvents } from "@/lib/results-normalizer";

export const dynamic = "force-dynamic";

async function fetchSportsDbPreviousEvents(leagueId) {
  const apiKey = process.env.THESPORTSDB_API_KEY || "3";
  const sportsDbLeagueId = getSportsDbLeagueId(leagueId);

  if (!sportsDbLeagueId) {
    return {
      ok: false,
      source: "thesportsdb",
      error: `No TheSportsDB league mapping for ${leagueId}`,
      results: [],
    };
  }

  const url = new URL(
    `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventspastleague.php`
  );

  url.searchParams.set("id", sportsDbLeagueId);

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return {
        ok: false,
        source: "thesportsdb",
        status: res.status,
        error: text,
        results: [],
      };
    }

    let json;

    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        source: "thesportsdb",
        error: "Invalid JSON from TheSportsDB",
        raw: text,
        results: [],
      };
    }

    const events = Array.isArray(json?.events) ? json.events : [];
    const results = normalizeSportsDbEvents(events);

    return {
      ok: true,
      source: "thesportsdb",
      sportsDbLeagueId,
      rawCount: events.length,
      resultCount: results.length,
      results,
    };
  } catch (error) {
    return {
      ok: false,
      source: "thesportsdb",
      error: error.message,
      results: [],
    };
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const sport = searchParams.get("sport") || "all";
  const league = searchParams.get("league") || "NHL";

  const providerResult = await fetchSportsDbPreviousEvents(league);

  return NextResponse.json({
    ok: providerResult.ok,
    source: "thesportsdb",
    sport,
    league,
    reason: providerResult.ok
      ? ""
      : providerResult.error || "Results provider failed.",
    results: providerResult.results || [],
    debug: {
      requestedSport: sport,
      requestedLeague: league,
      ...providerResult,
    },
  });
}
