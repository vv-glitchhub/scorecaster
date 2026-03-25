import { NextResponse } from "next/server";

// 🔥 SIMPLE CACHE
let CACHE = {};
let LAST_FETCH = 0;
const CACHE_TIME = 60 * 1000; // 60 sek

function cleanLeagueName(name = "") {
  return name
    .replace(/^Soccer - /i, "")
    .replace(/^Ice Hockey - /i, "")
    .replace(/^Basketball - /i, "")
    .replace(/^American Football - /i, "");
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

    // 🔥 suodata h2h
    bookmakers: (g.bookmakers || []).map((b) => ({
      ...b,
      markets: (b.markets || []).filter((m) => m.key === "h2h")
    })),

    context: ""
  };
}

function isTodayOrTomorrow(iso) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 2);

  const gameDate = new Date(iso);

  return gameDate >= today && gameDate < tomorrow;
}

// 🔥 FALLBACK DATA (aina jotain näkyy)
function fallbackGames() {
  return [
    {
      id: "demo-1",
      home: "Tappara",
      away: "Ilves",
      league: "Liiga",
      time: "18:30",
      commence_time: new Date().toISOString(),
      bookmakers: [],
      context: "Fallback demo"
    },
    {
      id: "demo-2",
      home: "Arsenal",
      away: "Chelsea",
      league: "Premier League",
      time: "20:30",
      commence_time: new Date().toISOString(),
      bookmakers: [],
      context: "Fallback demo"
    }
  ];
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

    // 🔥 CACHE HIT
    if (
      CACHE[sportKey] &&
      Date.now() - LAST_FETCH < CACHE_TIME
    ) {
      return NextResponse.json({ games: CACHE[sportKey] });
    }

    const apiKey = process.env.ODDS_API_KEY;

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
      isTodayOrTomorrow(g.commence_time)
    );

    const source = filtered.length ? filtered : data;

    const games = source
      .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
      .slice(0, 40)
      .map(formatGame);

    // 🔥 SAVE CACHE
    CACHE[sportKey] = games;
    LAST_FETCH = Date.now();

    return NextResponse.json({ games });

  } catch (error) {
    console.log("API FAIL → fallback");

    return NextResponse.json({
      games: fallbackGames(),
      error: error.message
    });
  }
}
