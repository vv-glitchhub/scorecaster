import { NextResponse } from "next/server";

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
        ),
        makeH2HMarket(
          [
            { name: "HJK", price: 2.18 },
            { name: "Draw", price: 3.4 },
            { name: "KuPS", price: 3.15 }
          ],
          "Unibet"
        )
      ]
    },
    {
      id: "fb-2",
      league: "Premier League",
      home: "Arsenal",
      away: "Chelsea",
      time: "20:30",
      context: "Lontoon derby",
      commence_time: isoAtToday(20, 30),
      homeForm: ["W", "W", "W", "D", "W"],
      awayForm: ["L", "W", "D", "L", "W"],
      h2h: "Arsenal unbeaten in last 3",
      bookmakers: [
        makeH2HMarket(
          [
            { name: "Arsenal", price: 1.95 },
            { name: "Draw", price: 3.7 },
            { name: "Chelsea", price: 4.0 }
          ],
          "Bet365"
        ),
        makeH2HMarket(
          [
            { name: "Arsenal", price: 2.0 },
            { name: "Draw", price: 3.65 },
            { name: "Chelsea", price: 3.95 }
          ],
          "Pinnacle"
        )
      ]
    },
    {
      id: "fb-3",
      league: "La Liga",
      home: "Real Sociedad",
      away: "Sevilla",
      time: "22:00",
      context: "Tärkeät pisteet",
      commence_time: isoAtToday(22, 0),
      homeForm: ["D", "W", "L", "W", "W"],
      awayForm: ["L", "D", "W", "L", "D"],
      h2h: "Low-scoring meetings recently",
      bookmakers: [
        makeH2HMarket(
          [
            { name: "Real Sociedad", price: 2.05 },
            { name: "Draw", price: 3.1 },
            { name: "Sevilla", price: 3.9 }
          ],
          "Unibet"
        ),
        makeH2HMarket(
          [
            { name: "Real Sociedad", price: 2.1 },
            { name: "Draw", price: 3.05 },
            { name: "Sevilla", price: 3.85 }
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
        ),
        makeH2HMarket(
          [
            { name: "Tappara", price: 2.08 },
            { name: "Ilves", price: 1.91 }
          ],
          "Unibet"
        )
      ]
    },
    {
      id: "hk-2",
      league: "Liiga",
      home: "Lukko",
      away: "Karpat",
      time: "18:30",
      context: "Kärkikamppailu",
      commence_time: isoAtToday(18, 30),
      homeForm: ["W", "W", "W", "L", "W"],
      awayForm: ["W", "L", "W", "W", "L"],
      h2h: "Lukko slightly better in recent meetings",
      bookmakers: [
        makeH2HMarket(
          [
            { name: "Lukko", price: 1.92 },
            { name: "Karpat", price: 2.02 }
          ],
          "Veikkaus"
        ),
        makeH2HMarket(
          [
            { name: "Lukko", price: 1.95 },
            { name: "Karpat", price: 2.0 }
          ],
          "Pinnacle"
        )
      ]
    },
    {
      id: "hk-3",
      league: "NHL",
      home: "Toronto Maple Leafs",
      away: "Boston Bruins",
      time: "02:00",
      context: "Original Six clash",
      commence_time: isoAtToday(2, 0),
      homeForm: ["W", "L", "W", "W", "L"],
      awayForm: ["W", "W", "L", "W", "D"],
      h2h: "Boston has won 3 of last 5",
      bookmakers: [
        makeH2HMarket(
          [
            { name: "Toronto Maple Leafs", price: 2.25 },
            { name: "Boston Bruins", price: 1.72 }
          ],
          "Bet365"
        ),
        makeH2HMarket(
          [
            { name: "Toronto Maple Leafs", price: 2.28 },
            { name: "Boston Bruins", price: 1.75 }
          ],
          "Pinnacle"
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
        ),
        makeH2HMarket(
          [
            { name: "Boston Celtics", price: 1.65 },
            { name: "Miami Heat", price: 2.32 }
          ],
          "Pinnacle"
        )
      ]
    },
    {
      id: "bk-2",
      league: "Korisliiga",
      home: "Kataja",
      away: "Seagulls",
      time: "18:00",
      context: "Kotimainen huippupeli",
      commence_time: isoAtToday(18, 0),
      homeForm: ["W", "L", "W", "W", "W"],
      awayForm: ["W", "W", "L", "D", "W"],
      h2h: "Seagulls slight edge recently",
      bookmakers: [
        makeH2HMarket(
          [
            { name: "Kataja", price: 2.4 },
            { name: "Seagulls", price: 1.58 }
          ],
          "Veikkaus"
        ),
        makeH2HMarket(
          [
            { name: "Kataja", price: 2.45 },
            { name: "Seagulls", price: 1.6 }
          ],
          "Coolbet"
        )
      ]
    }
  ];
}

function getGamesBySport(sport) {
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

    const games = getGamesBySport(sport);

    return NextResponse.json({
      sport,
      games
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch games"
      },
      { status: 500 }
    );
  }
}
