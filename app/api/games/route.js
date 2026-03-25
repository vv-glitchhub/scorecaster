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

function isoAtToday(hour, minute = 0) {
  const now = new Date();
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0
  );
  return d.toISOString();
}

function makeH2HMarket(outcomes, bookmakerTitle) {
  return {
    title: bookmakerTitle,
    markets: [
      {
        key: "h2h",
        outcomes
      }
    ]
  };
}

function footballGames() {
  return [
    {
      id: "fb-1",
      league: "Veikkausliiga",
      home: "HJK",
      away: "KuPS",
      time: "18:00",
      context: "Huippuottelu",
      commence_time: isoAtToday(18, 0),
      homeForm: ["W", "W", "D", "L", "W"],
      awayForm: ["W", "D", "W", "W", "L"],
      h2h: "HJK 2 wins, KuPS 2 wins, 1 draw",
      bookmakers: [
        makeH2HMarket(
          [
            { name: "HJK", price: 2.15 },
            { name: "Draw", price: 3.35 },
            { name: "KuPS", price: 3.2 }
          ],
          "Veikkaus"
        ),
        makeH2HMarket(
          [
            { name: "HJK", price: 2.2 },
            { name: "Draw", price: 3.3 },
            { name: "KuPS", price: 3.25 }
          ],
          "Coolbet"
        )
      ]
    }
  ];
}

function hockeyGames() {
  return [
    {
      id: "hk-1",
      league: "Liiga",
      home: "Tappara",
      away: "Ilves",
      time: "18:30",
      context: "Tampereen derby",
      commence_time: isoAtToday(18, 30),
      homeForm: ["W", "W", "L", "W", "OTW"],
      awayForm: ["L", "W", "W", "L", "W"],
      h2h: "Very even recent derby results",
      bookmakers: [
        makeH2HMarket(
          [
            { name: "Tappara", price: 2.05 },
            { name: "Ilves", price: 1.88 }
          ],
          "Veikkaus"
        ),
        makeH2HMarket(
          [
            { name: "Tappara", price: 2.1 },
            { name: "Ilves", price: 1.9 }
          ],
          "Coolbet"
        )
      ]
    }
  ];
}

function basketballGames() {
  return [
    {
      id: "bk-1",
      league: "NBA",
      home: "Boston Celtics",
      away: "Miami Heat",
      time: "02:30",
      context: "Playoff-level matchup",
      commence_time: isoAtToday(2, 30),
      homeForm: ["W", "W", "W", "L", "W"],
      awayForm: ["L", "W", "L", "W", "W"],
      h2h: "Boston stronger at home",
      bookmakers: [
        makeH2HMarket(
          [
            { name: "Boston Celtics", price: 1.62 },
            { name: "Miami Heat", price: 2.35 }
          ],
          "Bet365"
        )
      ]
    }
  ];
}

function getMockGamesBySport(sport) {
  switch (sport) {
    case "jalkapallo":
      return footballGames();
    case "jaakiekko":
      return hockeyGames();
    case "koripallo":
      return basketballGames();
    default:
      return [];
  }
}

function cleanLeagueName(name = "") {
  return name
    .replace(/^Soccer - /i, "")
    .replace(/^Ice Hockey - /i, "")
    .replace(/^Basketball - /i, "");
}

function formatApiGame(g) {
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

async function fetchSportGames(sportKey) {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    throw new Error("ODDS_API_KEY puuttuu .env.local-tiedostosta");
  }

  const url =
    `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/` +
    `?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Odds API virhe (${sportKey}): ${text}`);
  }

  return res.json();
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport");

    if (!sport) {
      return NextResponse.json(
        { error: "Missing sport parameter" },
        { status: 400 }
      );
    }

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
        const data = await fetchSportGames(key);
        allGames = allGames.concat(data);
      } catch (err) {
        console.error(`Virhe haettaessa ${key}:`, err.message);
      }
    }

    const uniqueGames = allGames.filter((game, index, arr) => {
      return index === arr.findIndex((g) => g.id === game.id);
    });

    const filtered = uniqueGames.filter((g) =>
      isTodayOrTomorrowInFinland(g.commence_time)
    );

    const source = filtered.length > 0 ? filtered : uniqueGames;

    const games = source
      .sort((a, b) => {
        const timeDiff =
          new Date(a.commence_time).getTime() -
          new Date(b.commence_time).getTime();

        if (timeDiff !== 0) return timeDiff;
        return (a.sport_title || "").localeCompare(b.sport_title || "");
      })
      .slice(0, 30)
      .map(formatApiGame);

    // jos API ei palauttanut mitään → fallback mock-dataan
    if (!games.length) {
      return NextResponse.json({
        sport,
        games: getMockGamesBySport(sport),
        source: "mock"
      });
    }

    return NextResponse.json({
      sport,
      games,
      source: "api"
    });
  } catch (error) {
    console.error("games route error:", error);

    return NextResponse.json({
      sport: null,
      games: [],
      source: "error",
      error: error?.message || "Failed to fetch games"
    });
  }
}
