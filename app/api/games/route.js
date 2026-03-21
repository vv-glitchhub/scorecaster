import { NextResponse } from "next/server";

const SPORT_KEYS = {
  jalkapallo: "soccer_finland_veikkausliiga",
  jaakiekko: "icehockey_nhl",
  koripallo: "basketball_nba"
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
    const sportKey = SPORT_KEYS[sport];

    if (!sportKey) {
      return NextResponse.json({ error: "Tuntematon laji" }, { status: 400 });
    }

    const url =
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds` +
      `?apiKey=${process.env.ODDS_API_KEY}` +
      `&regions=eu` +
      `&markets=h2h` +
      `&oddsFormat=decimal`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Odds API virhe", details: text },
        { status: 500 }
      );
    }

    const data = await res.json();

    const games = data
      .filter((g) => isTodayInFinland(g.commence_time))
      .slice(0, 12)
      .map((g) => ({
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
        bookmakers: g.bookmakers ?? []
      }));

    return NextResponse.json({ games });
  } catch (e) {
    return NextResponse.json(
      { error: "Pelien haku epäonnistui", details: e.message },
      { status: 500 }
    );
  }
}
