import { NextResponse } from "next/server";

const CACHE = new Map();
const CACHE_MS = 5 * 60 * 1000; // 5 min

function cleanLeagueName(name = "") {
  return name
    .replace(/^Soccer - /i, "")
    .replace(/^Ice Hockey - /i, "")
    .replace(/^Basketball - /i, "")
    .replace(/^American Football - /i, "")
    .replace(/^Baseball - /i, "")
    .replace(/^Mixed Martial Arts - /i, "");
}

function toFinlandDate(dateLike) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
    .formatToParts(new Date(dateLike))
    .reduce((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  );
}

function getFinlandNow() {
  return toFinlandDate(new Date());
}

function getDayLabel(commenceTime) {
  const game = toFinlandDate(commenceTime);
  const now = getFinlandNow();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const dayAfterTomorrowStart = new Date(todayStart);
  dayAfterTomorrowStart.setDate(todayStart.getDate() + 2);

  const thirdDayStart = new Date(todayStart);
  thirdDayStart.setDate(todayStart.getDate() + 3);

  if (game >= todayStart && game < tomorrowStart) return "Tänään";
  if (game >= tomorrowStart && game < dayAfterTomorrowStart) return "Huomenna";
  if (game >= dayAfterTomorrowStart && game < thirdDayStart) return "Ylihuomenna";
  return "Myöhemmin";
}

function isWithin3DaysInFinland(commenceTime) {
  const game = toFinlandDate(commenceTime);
  const now = getFinlandNow();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 3);

  return game >= start && game < end;
}

function normalizeBookmakers(bookmakers = []) {
  return bookmakers
    .map((b) => ({
      ...b,
      markets: (b.markets || []).filter((m) => m.key === "h2h")
    }))
    .filter((b) => (b.markets || []).length > 0);
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
    dayLabel: getDayLabel(g.commence_time),
    bookmakers: normalizeBookmakers(g.bookmakers || [])
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sportKey = searchParams.get("sportKey");

    if (!sportKey) {
      return NextResponse.json(
        { games: [], error: "Missing sportKey parameter" },
        { status: 400 }
      );
    }

    const cached = CACHE.get(sportKey);
    if (cached && Date.now() - cached.timestamp < CACHE_MS) {
      return NextResponse.json({
        games: cached.games,
        cached: true,
        lastUpdate: cached.timestamp
      });
    }

    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { games: [], error: "ODDS_API_KEY puuttuu" },
        { status: 500 }
      );
    }

    const url =
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/` +
      `?apiKey=${apiKey}&regions=eu&oddsFormat=decimal`;

    const res = await fetch(url, {
      next: { revalidate: 300 }
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        {
          games: [],
          error: data?.message || `Odds API error for sportKey: ${sportKey}`
        },
        { status: res.status }
      );
    }

    if (!Array.isArray(data)) {
      return NextResponse.json({
        games: [],
        error: `Unexpected API response for sportKey: ${sportKey}`
      });
    }

    const filtered = data.filter((g) =>
      isWithin3DaysInFinland(g.commence_time)
    );

    const games = filtered
      .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
      .slice(0, 50)
      .map(formatGame);

    const now = Date.now();

    CACHE.set(sportKey, {
      timestamp: now,
      games
    });

    return NextResponse.json({
      games,
      cached: false,
      lastUpdate: now
    });
  } catch (error) {
    return NextResponse.json(
      {
        games: [],
        error: error.message || "Pelien haku epäonnistui"
      },
      { status: 500 }
    );
  }
}
