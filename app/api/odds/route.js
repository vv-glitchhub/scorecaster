import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SGO_KEY = process.env.SPORTSGAMEODDS_API_KEY;
const TSDB_KEY = process.env.THESPORTSDB_API_KEY || "3";

const FINNISH_LEAGUES = {
  FIN_LIIGA: 4931,
  FIN_VEIKKAUSLIIGA: 4636,
};

function normalizeTSDB(event) {
  return {
    id: event.idEvent,
    sport_key: "FINLAND",
    sport_title: event.strLeague,
    commence_time: event.dateEvent,
    home_team: event.strHomeTeam,
    away_team: event.strAwayTeam,
    is_live: false,
    bestOdds: {
      home: null,
      draw: null,
      away: null,
    },
    fixturesOnly: true,
  };
}

async function fetchFinnishLeague(leagueKey) {
  const leagueID = FINNISH_LEAGUES[leagueKey];

  const url = `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}/eventsnextleague.php?id=${leagueID}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  if (!data?.events) return [];

  return data.events.map(normalizeTSDB);
}

function normalizeSGO(e) {
  return {
    id: e.eventID,
    sport_key: e.sportID,
    sport_title: e.leagueID,
    commence_time: e.status?.startsAt,
    is_live: e.status?.live || false,
    home_team: e.teams?.home?.names?.long || "Home",
    away_team: e.teams?.away?.names?.long || "Away",
    bestOdds: {
      home: 2.0,
      away: 1.8,
      draw: null,
    },
  };
}

async function fetchSGO() {
  if (!SGO_KEY) return [];

  const url =
    `https://api.sportsgameodds.com/v2/events` +
    `?apiKey=${SGO_KEY}` +
    `&oddsAvailable=true` +
    `&limit=50`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  if (!data?.data) return [];

  return data.data.map(normalizeSGO);
}

export async function GET(req) {
  const url = new URL(req.url);
  const league = url.searchParams.get("league") || "ALL";

  // 🇫🇮 SUOMI
  if (FINNISH_LEAGUES[league]) {
    const matches = await fetchFinnishLeague(league);

    return NextResponse.json({
      source: "thesportsdb",
      matches,
      note: "Suomen liigat ilman odds-dataa",
    });
  }

  // 🌍 MUUT
  const matches = await fetchSGO();

  return NextResponse.json({
    source: "sportsgameodds",
    matches,
  });
}
