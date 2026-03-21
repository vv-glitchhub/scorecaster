import { NextResponse } from "next/server";

const SPORT_KEYS = {
  jaakiekko: ["icehockey_nhl"],
  koripallo: ["basketball_nba"],
  jalkapallo: [
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
    "soccer_germany_bundesliga",
    "soccer_uefa_champs_league"
  ]
};

function formatGame(g) {
  return {
    id: g.id,
    home: g.home_team,
    away: g.away_team,
    league: g.sport_title,
    time: new Date(g.commence_time).toLocaleTimeString("fi-FI", {
      timeZone: "Europe/Helsinki",
      hour: "2-digit",
      minute: "2-digit"
    }),
    context: "Live odds data",
    bookmakers: g.bookmakers ?? [],
    commence_time: g.commence_time
  };
}

function isTodayOrTomorrowInFinland(isoString) {
  const d = new Date(isoString);
  const fi = d.toLocaleDateString("fi-FI", { timeZone: "Europe/Helsinki" });

  const now = new Date();
  const today = now.toLocaleDateString("fi-FI", { timeZone: "Europe/Helsinki" });

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrow = tomorrowDate.toLocaleDateString("fi-FI", {
    timeZone: "Europe/Helsinki"
  });

  return fi === today || fi === tomorrow;
}

async function fetchSportOdds(sportKey) {
  const url =
    `https://api.the-odds-api.com/v4/sports/${sportKey}/odds` +
    `?apiKey=${process.env.ODDS_API_KEY}` +
    `&regions=eu` +
    `&markets=h2h` +
    `&oddsFormat=decimal`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Odds API virhe (${sportKey}): ${text}`);
  }

  return await res.json();
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport") || "jalkapallo";
    const keys = SPORT_KEYS[sport];

    if (!keys) {
      return NextResponse.json(
        { error: "Tuntematon laji" },
        { status: 400 }
      );
    }

    let allGames = [];

    for (const key of keys) {
      try {
        const data = await fetchSportOdds(key);
        allGames.push(...data);
      } catch (err) {
        console.error(err.message);
      }
    }

    const seen = new Set();
    const uniqueGames = allGames.filter((g) => {
      const id = g.id || `${g.home_team}-${g.away_team}-${g.commence_time}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const filtered = uniqueGames.filter((g) =>
      isTodayOrTomorrowInFinland(g.commence_time)
    );

    const source = filtered.length > 0 ? filtered : uniqueGames;

    const games = source
      .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
      .slice(0, 20)
      .map(formatGame);

    return NextResponse.json({ games });
  } catch (e) {
    return NextResponse.json(
      { error: "Pelien haku epäonnistui", details: e.message },
      { status: 500 }
    );
  }
}
