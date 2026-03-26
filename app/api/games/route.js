import { NextResponse } from "next/server";

const API_KEY = process.env.ODDS_API_KEY;

const SPORT_KEYS = {
  jaakiekko: ["icehockey_liiga", "icehockey_nhl"],
  jalkapallo: [
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
    "soccer_germany_bundesliga"
  ],
  koripallo: ["basketball_nba"]
};

function toFinlandTime(date) {
  return new Date(
    new Date(date).toLocaleString("en-US", {
      timeZone: "Europe/Helsinki"
    })
  );
}

function isValidGame(time) {
  const now = toFinlandTime(new Date());
  const gameTime = toFinlandTime(time);

  const threeDays = 3 * 24 * 60 * 60 * 1000;

  return gameTime >= now && gameTime <= new Date(now.getTime() + threeDays);
}

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

    const keys = SPORT_KEYS[sport];
    if (!keys) {
      return NextResponse.json({ games: [] });
    }

    let allGames = [];

    for (const key of keys) {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${key}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h`,
        { next: { revalidate: 60 } }
      );

      const data = await res.json();

      if (Array.isArray(data)) {
        allGames.push(...data);
      }
    }

    const unique = Object.values(
      Object.fromEntries(allGames.map(g => [g.id, g]))
    );

    const filtered = unique.filter(g => isValidGame(g.commence_time));

    const games = filtered
      .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
      .slice(0, 30)
      .map(formatGame);

    return NextResponse.json({
      games,
      lastUpdated: new Date().toISOString()
    });

  } catch (e) {
    return NextResponse.json({ games: [] });
  }
}
