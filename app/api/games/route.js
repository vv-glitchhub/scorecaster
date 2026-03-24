import { NextResponse } from "next/server";

const SPORT_KEYS = {
  jalkapallo: [
    "soccer_finland_veikkausliiga",
    "soccer_uefa_champs_league",
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
    "soccer_germany_bundesliga"
  ],
  jaakiekko: [
    "icehockey_finland_liiga",
    "icehockey_nhl"
  ],
  koripallo: [
    "basketball_nba",
    "basketball_euroleague"
  ]
};

function isTodayInFinland(isoString) {
  const d = new Date(isoString);
  const fiDate = d.toLocaleDateString("fi-FI", {
    timeZone: "Europe/Helsinki"
  });

  const todayFi = new Date().toLocaleDateString("fi-FI", {
    timeZone: "Europe/Helsinki"
  });

  return fiDate === todayFi;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport") || "jalkapallo";
    const sportKeys = SPORT_KEYS[sport];

    if (!sportKeys) {
      return NextResponse.json(
        { error: "Tuntematon laji" },
        { status: 400 }
      );
    }

    const allGames = [];

    for (const sportKey of sportKeys) {
      const url =
        `https://api.the-odds-api.com/v4/sports/${sportKey}/odds` +
        `?apiKey=${process.env.ODDS_API_KEY}` +
        `&regions=eu` +
        `&markets=h2h` +
        `&oddsFormat=decimal`;

      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        continue;
      }

      const data = await res.json();

      const games = (data || [])
        .filter((g) => isTodayInFinland(g.commence_time))
        .map((g) => ({
          id: g.id,
          home: g.home_team,
          away: g.away_team,
          league: g.sport_title,
          commence_time: g.commence_time,
          time: new Date(g.commence_time).toLocaleTimeString("fi-FI", {
            timeZone: "Europe/Helsinki",
            hour: "2-digit",
            minute: "2-digit"
          }),
          context: "Live odds data",
          bookmakers: g.bookmakers ?? []
        }));

      allGames.push(...games);
    }

    allGames.sort(
      (a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
    );

    return NextResponse.json({ games: allGames });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Pelien haku epäonnistui",
        details: e.message
      },
      { status: 500 }
    );
  }
}
