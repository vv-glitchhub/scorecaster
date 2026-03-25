import { NextResponse } from "next/server";

function cleanLeagueName(name = "") {
  return name
    .replace(/^Soccer - /i, "")
    .replace(/^Ice Hockey - /i, "")
    .replace(/^Basketball - /i, "")
    .replace(/^American Football - /i, "")
    .replace(/^Baseball - /i, "")
    .replace(/^Mixed Martial Arts - /i, "");
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
    bookmakers: g.bookmakers || [],
    context: ""
  };
}

function isTodayOrTomorrowInFinland(iso) {
  const gameDate = new Date(iso);

  const now = new Date();
  const finlandNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Helsinki" })
  );

  const todayStart = new Date(finlandNow);
  todayStart.setHours(0, 0, 0, 0);

  const dayAfterTomorrowStart = new Date(todayStart);
  dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 2);

  const gameInFinland = new Date(
    gameDate.toLocaleString("en-US", { timeZone: "Europe/Helsinki" })
  );

  return gameInFinland >= todayStart && gameInFinland < dayAfterTomorrowStart;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sportKey = searchParams.get("sportKey");

    if (!sportKey) {
      return NextResponse.json(
        { error: "Missing sportKey parameter" },
        { status: 400 }
      );
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
      `?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Odds API virhe: ${text}`);
    }

    const data = await res.json();

    const filtered = data.filter((g) => isTodayOrTomorrowInFinland(g.commence_time));
    const source = filtered.length > 0 ? filtered : data;

    const games = source
      .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
      .slice(0, 50)
      .map(formatGame);

    return NextResponse.json({ games });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Pelien haku epäonnistui" },
      { status: 500 }
    );
  }
}
