import { NextResponse } from "next/server";

// 🔥 CACHE (estää rate limit)
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

    bookmakers: (g.bookmakers || []).map((b) => ({
      ...b,
      markets: (b.markets || []).filter((m) => m.key === "h2h")
    })),

    context: ""
  };
}

// 🔥 3 PÄIVÄN FILTER (Suomen aika)
function isWithin3DaysInFinland(iso) {
  const gameDate = new Date(iso);

  const now = new Date();
  const finNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Helsinki" })
  );

  const start = new Date(finNow);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 3); // 🔥 3 päivää

  const gameFin = new Date(
    gameDate.toLocaleString("en-US", { timeZone: "Europe/Helsinki" })
  );

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

    // 🔥 CACHE HIT
    if (
      CACHE[sportKey] &&
      LAST_FETCH[sportKey] &&
      Date.now() - LAST_FETCH[sportKey] < CACHE_TIME
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

    // 🔥 FILTER 3 PÄIVÄÄ
    const filtered = data.filter((g) =>
      isWithin3DaysInFinland(g.commence_time)
    );

    console.log("ALL:", data.length);
    console.log("3 DAYS:", filtered.length);

    // ❗ EI fallback sekoilua
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

    // 🔥 SAVE CACHE
    CACHE[sportKey] = games;
    LAST_FETCH[sportKey] = Date.now();

    return NextResponse.json({ games });

  } catch (error) {
    console.log("API ERROR:", error.message);

    return NextResponse.json(
      {
        games: [],
        error: error.message
      },
      { status: 500 }
    );
  }
}
