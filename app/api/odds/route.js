import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SGO_KEY = process.env.SPORTSGAMEODDS_API_KEY;
const TSDB_KEY = process.env.THESPORTSDB_API_KEY || "3";

const FINNISH_LEAGUES = {
  FIN_LIIGA: "4931",
  FIN_VEIKKAUSLIIGA: "4636",
};

function normalizeSGO(e) {
  return {
    id: e.eventID,
    sport: e.sportID,
    league: e.leagueID,
    home: e.teams?.home?.names?.long,
    away: e.teams?.away?.names?.long,
    time: e.status?.startsAt,
    live: e.status?.live,
    odds: {
      home: 2.0,
      away: 1.8,
      draw: null,
    },
  };
}

function normalizeTSDB(e) {
  return {
    id: e.idEvent,
    sport: "FINLAND",
    league: e.strLeague,
    home: e.strHomeTeam,
    away: e.strAwayTeam,
    time: e.dateEvent,
    live: false,
    odds: null,
    fixturesOnly: true,
  };
}

async function fetchSGO(league) {
  const url = `https://api.sportsgameodds.com/v2/events?apiKey=${SGO_KEY}&leagueID=${league}&oddsAvailable=true`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data?.data) return [];

  return data.data.map(normalizeSGO);
}

async function fetchTSDB(leagueKey) {
  const id = FINNISH_LEAGUES[leagueKey];

  const url = `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}/eventsnextleague.php?id=${id}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data?.events) return [];

  return data.events.map(normalizeTSDB);
}

export async function GET(req) {
  const url = new URL(req.url);

  const league = url.searchParams.get("league") || "ALL";
  const oddsOnly = url.searchParams.get("oddsOnly") === "1";

  let matches = [];

  // 🇫🇮 SUOMI
  if (FINNISH_LEAGUES[league]) {
    matches = await fetchTSDB(league);
  } else {
    // 🌍 MUUT
    const leagues =
      league === "ALL"
        ? ["NHL", "NBA", "NFL", "MLB"]
        : [league];

    const results = await Promise.all(leagues.map(fetchSGO));
    matches = results.flat();
  }

  // filter
  if (oddsOnly) {
    matches = matches.filter((m) => m.odds !== null);
  }

  return NextResponse.json({
    matches,
    count: matches.length,
  });
}
