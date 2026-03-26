import { NextResponse } from "next/server";

const API_KEY = process.env.ODDS_API_KEY;

const SPORT_KEYS = {
  jaakiekko: ["icehockey_liiga", "icehockey_nhl"],
  jalkapallo: [
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
    "soccer_germany_bundesliga",
    "soccer_uefa_champs_league"
  ],
  koripallo: ["basketball_nba"]
};

// 🔥 Suomen aika helper
function toFinlandTime(date) {
  return new Date(
    new Date(date).toLocaleString("en-US", {
      timeZone: "Europe/Helsinki"
    })
  );
}

// 🔥 SUODATUS: vain tulevat + 3 päivää
function isValidGame(time) {
  const now = toFinlandTime(new Date());
  const gameTime = toFinlandTime(time);

  const threeDays = 3 * 24 * 60 * 60 * 1000;

  return gameTime >= now && gameTime <= new Date(now.getTime() + threeDays);
}

// 🔥 formatointi
function formatGame(g) {
  const finTime = toFinlandTime(g.commence_time);

  return {
    id: g.id,
    home: g.home_team,
    away: g.away_team,
    league: g.sport_title,
    time: finTime.toLocaleTimeString("fi-FI", {
      hour: "2-digit",
      minute: "2-digit"
    }),
    date: finTime.toLocaleDateString("fi-FI"),
    odds: g.bookmakers?.[0]?.markets?.[0]?.outcomes || []
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport");

    if (!sport) {
      return NextResponse.json({ error: "Missing sport" }, { status: 400 });
    }

    const keys = SPORT_KEYS[sport];
    if (!keys) {
      return NextResponse.json({ error: "Invalid sport" }, { status: 400 });
    }

    let allGames = [];

    for (const key of keys) {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${key}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h`,
        { next: { revalidate: 60 } } // 🔥 cache 60s → ei rate limit
      );

      const data = await res.json();

      if (Array.isArray(data)) {
        allGames.push(...data);
      }
    }

    // 🔥 poistetaan duplikaatit
    const unique = Object.values(
      Object.fromEntries(allGames.map(g => [g.id, g]))
    );

    // 🔥 SUODATUS
    const filtered = unique.filter(g => isValidGame(g.commence_time));

    // 🔥 SORT
    const games = filtered
      .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
      .slice(0, 30)
      .map(formatGame);

    return NextResponse.json({
      games,
      lastUpdated: new Date().toISOString() // 🔥 TÄRKEÄ
    });

  } catch (e) {
    return NextResponse.json({
      error: e.message || "Failed"
    }, { status: 500 });
  }
}
