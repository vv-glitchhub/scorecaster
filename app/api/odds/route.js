import { NextResponse } from "next/server";

const DEMO_GAMES = {
  icehockey_liiga: [
    {
      id: "demo-liiga-1",
      sport_key: "icehockey_liiga",
      sport_title: "Liiga",
      commence_time: "2026-04-05T17:30:00Z",
      home_team: "Tappara",
      away_team: "Ilves",
      bookmakers: [
        {
          key: "demobook",
          title: "DemoBook",
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Tappara", price: 2.25 },
                { name: "Ilves", price: 1.78 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "demo-liiga-2",
      sport_key: "icehockey_liiga",
      sport_title: "Liiga",
      commence_time: "2026-04-06T15:00:00Z",
      home_team: "Lukko",
      away_team: "TPS",
      bookmakers: [
        {
          key: "demobook",
          title: "DemoBook",
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Lukko", price: 1.92 },
                { name: "TPS", price: 2.02 },
              ],
            },
          ],
        },
      ],
    },
  ],
  icehockey_nhl: [
    {
      id: "demo-nhl-1",
      sport_key: "icehockey_nhl",
      sport_title: "NHL",
      commence_time: "2026-04-05T23:00:00Z",
      home_team: "Boston Bruins",
      away_team: "Toronto Maple Leafs",
      bookmakers: [
        {
          key: "demobook",
          title: "DemoBook",
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Boston Bruins", price: 2.05 },
                { name: "Toronto Maple Leafs", price: 1.87 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "demo-nhl-2",
      sport_key: "icehockey_nhl",
      sport_title: "NHL",
      commence_time: "2026-04-06T00:30:00Z",
      home_team: "New York Rangers",
      away_team: "New Jersey Devils",
      bookmakers: [
        {
          key: "demobook",
          title: "DemoBook",
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "New York Rangers", price: 1.95 },
                { name: "New Jersey Devils", price: 1.98 },
              ],
            },
          ],
        },
      ],
    },
  ],
  basketball_nba: [
    {
      id: "demo-nba-1",
      sport_key: "basketball_nba",
      sport_title: "NBA",
      commence_time: "2026-04-05T23:30:00Z",
      home_team: "Boston Celtics",
      away_team: "Milwaukee Bucks",
      bookmakers: [
        {
          key: "demobook",
          title: "DemoBook",
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Boston Celtics", price: 1.83 },
                { name: "Milwaukee Bucks", price: 2.08 },
              ],
            },
          ],
        },
      ],
    },
  ],
  soccer_epl: [
    {
      id: "demo-epl-1",
      sport_key: "soccer_epl",
      sport_title: "Premier League",
      commence_time: "2026-04-06T14:00:00Z",
      home_team: "Arsenal",
      away_team: "Tottenham",
      bookmakers: [
        {
          key: "demobook",
          title: "DemoBook",
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Arsenal", price: 2.12 },
                { name: "Draw", price: 3.45 },
                { name: "Tottenham", price: 3.15 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const LAST_GOOD_CACHE = new Map();

function getDemoGames(sport) {
  return DEMO_GAMES[sport] || [];
}

function isUsableGame(game) {
  return (
    game?.home_team &&
    game?.away_team &&
    Array.isArray(game?.bookmakers) &&
    game.bookmakers.length > 0
  );
}

function sortByTimeAscending(games) {
  return [...games].sort((a, b) => {
    const aTime = new Date(a.commence_time || 0).getTime();
    const bTime = new Date(b.commence_time || 0).getTime();
    return aTime - bTime;
  });
}

function getCachedGames(sport) {
  const hit = LAST_GOOD_CACHE.get(sport);
  if (!hit) return [];
  return sortByTimeAscending(hit.data || []);
}

function setCachedGames(sport, games) {
  LAST_GOOD_CACHE.set(sport, {
    savedAt: Date.now(),
    data: sortByTimeAscending(games),
  });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport");
    const group = searchParams.get("group");
    const apiKey = process.env.ODDS_API_KEY;

    console.log("ODDS_API_KEY exists:", !!apiKey);
    console.log("ODDS_API_KEY prefix:", apiKey ? apiKey.slice(0, 6) : "missing");

    if (!sport) {
      return NextResponse.json({
        data: [],
        source: "empty",
        empty: true,
        quotaExceeded: false,
        message: "Missing sport parameter",
        debug: {
          requestedSport: sport,
          requestedGroup: group,
        },
      });
    }

    if (!apiKey) {
      const cached = getCachedGames(sport);
      if (cached.length > 0) {
        return NextResponse.json({
          data: cached,
          source: "cached",
          empty: false,
          quotaExceeded: false,
          message: "ODDS_API_KEY missing, using last cached live data",
          debug: {
            requestedSport: sport,
            requestedGroup: group,
            reason: "missing_api_key",
            cachedCount: cached.length,
            demoCount: 0,
          },
        });
      }

      const demo = sortByTimeAscending(getDemoGames(sport));
      return NextResponse.json({
        data: demo,
        source: "demo",
        empty: demo.length === 0,
        quotaExceeded: false,
        message: "ODDS_API_KEY missing, using demo fallback",
        debug: {
          requestedSport: sport,
          requestedGroup: group,
          reason: "missing_api_key",
          cachedCount: 0,
          demoCount: demo.length,
        },
      });
    }

    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;

    const res = await fetch(url, {
      next: { revalidate: 300 },
    });

    const text = await res.text();

    let json = [];
    try {
      json = JSON.parse(text);
    } catch {
      json = [];
    }

    const rawGames = Array.isArray(json) ? json : [];
    const usableGames = sortByTimeAscending(rawGames.filter(isUsableGame));

    if (res.ok && usableGames.length > 0) {
      setCachedGames(sport, usableGames);

      return NextResponse.json({
        data: usableGames,
        source: "live",
        empty: false,
        quotaExceeded: false,
        message: "Showing fresh live data",
        debug: {
          requestedSport: sport,
          requestedGroup: group,
          rawCount: rawGames.length,
          usableCount: usableGames.length,
          cachedCount: usableGames.length,
          demoCount: 0,
          status: res.status,
        },
      });
    }

    const quotaExceeded = res.status === 429;
    const cached = getCachedGames(sport);

    if (cached.length > 0) {
      return NextResponse.json({
        data: cached,
        source: "cached",
        empty: false,
        quotaExceeded,
        message: quotaExceeded
          ? "API quota exceeded, using last cached live data"
          : "Live data unavailable, using last cached live data",
        debug: {
          requestedSport: sport,
          requestedGroup: group,
          rawCount: rawGames.length,
          usableCount: usableGames.length,
          cachedCount: cached.length,
          demoCount: 0,
          status: res.status,
        },
      });
    }

    const demo = sortByTimeAscending(getDemoGames(sport));

    return NextResponse.json({
      data: demo,
      source: "demo",
      empty: demo.length === 0,
      quotaExceeded,
      message: quotaExceeded
        ? "API quota exceeded, using demo fallback"
        : "Live data unavailable, using demo fallback",
      debug: {
        requestedSport: sport,
        requestedGroup: group,
        rawCount: rawGames.length,
        usableCount: usableGames.length,
        cachedCount: 0,
        demoCount: demo.length,
        status: res.status,
      },
    });
  } catch (error) {
    return NextResponse.json({
      data: [],
      source: "empty",
      empty: true,
      quotaExceeded: false,
      message: "odds route failed",
      debug: {
        error: error?.message || "unknown error",
      },
    });
  }
}
