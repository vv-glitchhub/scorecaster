import { NextResponse } from "next/server";

let CACHE = {};
let LAST_FETCH = {};
const CACHE_TIME = 60 * 1000; // 60 sek

function cleanLeagueName(name = "") {
  return name
    .replace(/^Soccer - /i, "")
    .replace(/^Ice Hockey - /i, "")
    .replace(/^Basketball - /i, "")
    .replace(/^American Football - /i, "");
}

function getFinlandNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki" })
  );
}

function getFinlandDate(dateLike) {
  return new Date(
    new Date(dateLike).toLocaleString("en-US", { timeZone: "Europe/Helsinki" })
  );
}

function getDayLabelInFinnish(commenceTime) {
  const gameFin = getFinlandDate(commenceTime);
  const nowFin = getFinlandNow();

  const todayStart = new Date(nowFin);
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const dayAfterTomorrowStart = new Date(todayStart);
  dayAfterTomorrowStart.setDate(todayStart.getDate() + 2);

  const thirdDayStart = new Date(todayStart);
  thirdDayStart.setDate(todayStart.getDate() + 3);

  if (gameFin >= todayStart && gameFin < tomorrowStart) return "Tänään";
  if (gameFin >= tomorrowStart && gameFin < dayAfterTomorrowStart) return "Huomenna";
  if (gameFin >= dayAfterTomorrowStart && gameFin < thirdDayStart) return "Ylihuomenna";
  return "Myöhemmin";
}

function formatGame(g) {
  return {
    id: g.id,
    home: g.home_team,
    away: g.away_team,
    league: cleanLeagueName(g.sport_title),
    time: new Date(g.commence_time).toLocaleTimeString("fi-FI", {
      timeZone: "Europe/Helsinki",
      hour: "2-digit",
      minute: "2-digit"
    }),
    commence_time: g.commence_time,
    dayLabel: getDayLabelInFinnish(g.commence_time),
    bookmakers: (g.bookmakers || []).map((b) => ({
      ...b,
      markets: (b.markets || []).filter((m) => m.key === "h2h")
    })),
    context: ""
  };
}

function isWithin3DaysInFinland(iso) {
  const gameFin = getFinlandDate(iso);
  const nowFin = getFinlandNow();

  const start = new Date(nowFin);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 3);

  return gameFin >= start && gameFin < end;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sportKey = searchParams.get("sportKey");

    if (!sportKey) {
      return NextResponse.json(
        { error: "Missing sportKey" },
        { status: 400 }
      );
    }

    if (
      CACHE[sportKey] &&
      LAST_FETCH[sportKey] &&
      Date.now() - LAST_FETCH[sportKey] < CACHE_TIME
    ) {
      return NextResponse.json({ games: CACHE[sportKey] });
    }

    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ODDS_API_KEY puuttuu .env.local-tiedostosta" },
        { status: 500 }
      );
    }

    const url =
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/` +
      `?apiKey=${apiKey}&regions=eu&oddsFormat=decimal`;

    const res = await fetch(url, {
      next: { revalidate: 60 }
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt);
    }

    const data = await res.json();

    const filtered = data.filter((g) =>
      isWithin3DaysInFinland(g.commence_time)
    );

    if (filtered.length === 0) {
      return NextResponse.json({
        games: [],
        message: "Ei pelejä seuraavan 3 päivän aikana"
      });
    }

    const games = filtered
      .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
      .slice(0, 50)
      .map(formatGame);

    CACHE[sportKey] = games;
    LAST_FETCH[sportKey] = Date.now();

    return NextResponse.json({ games });
  } catch (error) {
    return NextResponse.json(
      {
        games: [],
        error: error.message
      },
      { status: 500 }
    );
  }
}
