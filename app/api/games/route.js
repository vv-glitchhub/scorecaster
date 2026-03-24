import { NextResponse } from "next/server";

const SPORT_KEYS = {
  jalkapallo: [
    "soccer_finland_veikkausliiga",
    "soccer_epl",
    "soccer_efl_champ",
    "soccer_england_league1",
    "soccer_england_league2",
    "soccer_fa_cup",
    "soccer_germany_bundesliga",
    "soccer_germany_bundesliga2",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
    "soccer_france_ligue_one",
    "soccer_france_ligue_two",
    "soccer_uefa_champs_league",
    "soccer_uefa_europa_league",
    "soccer_uefa_europa_conference_league",
    "soccer_usa_mls",
    "soccer_netherlands_eredivisie",
    "soccer_portugal_primeira_liga",
    "soccer_turkey_super_league",
    "soccer_belgium_first_div",
    "soccer_denmark_superliga",
    "soccer_austria_bundesliga",
    "soccer_sweden_allsvenskan",
    "soccer_norway_eliteserien",
    "soccer_brazil_campeonato",
    "soccer_argentina_primera_division",
    "soccer_conmebol_copa_libertadores",
    "soccer_conmebol_copa_sudamericana",
    "soccer_concacaf_leagues_cup"
  ],

  jaakiekko: [
    "icehockey_liiga",
    "icehockey_mestis",
    "icehockey_nhl",
    "icehockey_ahl",
    "icehockey_sweden_hockey_league",
    "icehockey_sweden_allsvenskan"
  ],

  koripallo: [
    "basketball_nba",
    "basketball_wnba",
    "basketball_euroleague",
    "basketball_ncaab",
    "basketball_ncaaw"
  ]
};

function formatTimeInFinland(isoString) {
  return new Date(isoString).toLocaleTimeString("fi-FI", {
    timeZone: "Europe/Helsinki",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isWithinNextDaysInFinland(isoString, daysAhead = 3) {
  const game = new Date(isoString);

  const now = new Date();
  const fiNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Helsinki" })
  );

  const fiEnd = new Date(fiNow);
  fiEnd.setHours(23, 59, 59, 999);
  fiEnd.setDate(fiEnd.getDate() + daysAhead);

  const fiGame = new Date(
    game.toLocaleString("en-US", { timeZone: "Europe/Helsinki" })
  );

  return fiGame >= fiNow && fiGame <= fiEnd;
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
    return [];
  }

  const data = await res.json();

  return (data || []).map((g) => ({
    id: g.id,
    home: g.home_team,
    away: g.away_team,
    league: g.sport_title,
    sportKey: g.sport_key,
    commence_time: g.commence_time,
    time: formatTimeInFinland(g.commence_time),
    context: "Live odds data",
    bookmakers: g.bookmakers ?? []
  }));
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

    const results = await Promise.all(sportKeys.map(fetchSportOdds));
    const allGames = results.flat();

    const uniqueGamesMap = new Map();

    for (const game of allGames) {
      if (!uniqueGamesMap.has(game.id)) {
        uniqueGamesMap.set(game.id, game);
      }
    }

    let finalGames = Array.from(uniqueGamesMap.values());

    // Tänään + seuraavat 3 päivää
    finalGames = finalGames.filter((g) =>
      isWithinNextDaysInFinland(g.commence_time, 3)
    );

    finalGames.sort(
      (a, b) =>
        new Date(a.commence_time).getTime() -
        new Date(b.commence_time).getTime()
    );

    return NextResponse.json({
      games: finalGames,
      count: finalGames.length
    });
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
