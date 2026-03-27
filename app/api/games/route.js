import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

const CACHE = new Map();
const CACHE_MS = 5 * 60 * 1000;

function cleanLeagueName(name = "") {
  return name
    .replace(/^Soccer - /i, "")
    .replace(/^Ice Hockey - /i, "")
    .replace(/^Basketball - /i, "")
    .replace(/^American Football - /i, "")
    .replace(/^Baseball - /i, "")
    .replace(/^Mixed Martial Arts - /i, "");
}

function toFinlandDate(dateLike) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
    .formatToParts(new Date(dateLike))
    .reduce((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  );
}

function getFinlandNow() {
  return toFinlandDate(new Date());
}

function getDayLabel(commenceTime) {
  const game = toFinlandDate(commenceTime);
  const now = getFinlandNow();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const dayAfterTomorrowStart = new Date(todayStart);
  dayAfterTomorrowStart.setDate(todayStart.getDate() + 2);

  const thirdDayStart = new Date(todayStart);
  thirdDayStart.setDate(todayStart.getDate() + 3);

  if (game >= todayStart && game < tomorrowStart) return "Tänään";
  if (game >= tomorrowStart && game < dayAfterTomorrowStart) return "Huomenna";
  if (game >= dayAfterTomorrowStart && game < thirdDayStart) return "Ylihuomenna";
  return "Myöhemmin";
}

function isWithin3DaysInFinland(commenceTime) {
  const game = toFinlandDate(commenceTime);
  const now = getFinlandNow();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 3);

  return game >= start && game < end;
}

function normalizeBookmakers(bookmakers = []) {
  return bookmakers
    .map((b) => ({
      ...b,
      markets: (b.markets || []).filter((m) => m.key === "h2h")
    }))
    .filter((b) => (b.markets || []).length > 0);
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
    dayLabel: getDayLabel(g.commence_time),
    bookmakers: normalizeBookmakers(g.bookmakers || [])
  };
}

async function persistGames(sportKey, games) {
  let savedMatches = 0;
  let savedOdds = 0;

  const matchRows = games.map((game) => ({
    id: game.id,
    sport_key: sportKey,
    league: game.league,
    home_team: game.home,
    away_team: game.away,
    commence_time: game.commence_time,
    day_label: game.dayLabel,
    updated_at: new Date().toISOString()
  }));

  if (matchRows.length > 0) {
    const { error: matchError } = await supabase
      .from("matches")
      .upsert(matchRows, { onConflict: "id" });

    if (matchError) {
      throw new Error(`Supabase matches upsert error: ${matchError.message}`);
    }

    savedMatches = matchRows.length;
  }

  const oddsRows = [];

  for (const game of games) {
    for (const bookmaker of game.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        for (const outcome of market.outcomes || []) {
          oddsRows.push({
            match_id: game.id,
            bookmaker: bookmaker.title,
            market_key: market.key,
            outcome_name: outcome.name,
            odds: outcome.price
          });
        }
      }
    }
  }

  if (oddsRows.length > 0) {
    const { error: oddsError } = await supabase
      .from("odds_snapshots")
      .insert(oddsRows);

    if (oddsError) {
      throw new Error(`Supabase odds insert error: ${oddsError.message}`);
    }

    savedOdds = oddsRows.length;
  }

  return { savedMatches, savedOdds };
}

function buildBookmakersFromSnapshots(match, snapshots) {
  const outcomes = [];
  const seen = new Set();

  for (const row of snapshots) {
    const key = `${row.outcome_name}-${row.odds}`;

    if (seen.has(key)) continue;
    seen.add(key);

    outcomes.push({
      name: row.outcome_name,
      price: Number(row.odds)
    });
  }

  const sortedOutcomes = outcomes.sort((a, b) => {
    const homeA = a.name === match.home_team ? 0 : a.name === "Draw" ? 1 : 2;
    const homeB = b.name === match.home_team ? 0 : b.name === "Draw" ? 1 : 2;
    return homeA - homeB;
  });

  return [
    {
      key: "cached_best_odds",
      title: "Cached Best Odds",
      last_update: new Date().toISOString(),
      markets: [
        {
          key: "h2h",
          last_update: new Date().toISOString(),
          outcomes: sortedOutcomes
        }
      ]
    }
  ];
}

function formatDbGame(match, snapshots) {
  return {
    id: match.id,
    home: match.home_team,
    away: match.away_team,
    league: cleanLeagueName(match.league || ""),
    time: new Date(match.commence_time).toLocaleTimeString("fi-FI", {
      timeZone: "Europe/Helsinki",
      hour: "2-digit",
      minute: "2-digit"
    }),
    commence_time: match.commence_time,
    dayLabel: match.day_label || getDayLabel(match.commence_time),
    bookmakers: buildBookmakersFromSnapshots(match, snapshots)
  };
}

async function loadGamesFromSupabase(sportKey) {
  let query = supabase
    .from("matches")
    .select("*")
    .order("commence_time", { ascending: true })
    .limit(50);

  if (sportKey && sportKey !== "all") {
    query = query.eq("sport_key", sportKey);
  }

  const { data: matches, error: matchError } = await query;

  if (matchError) {
    throw new Error(`Supabase matches fetch error: ${matchError.message}`);
  }

  const filteredMatches = (matches || []).filter((m) =>
    isWithin3DaysInFinland(m.commence_time)
  );

  if (filteredMatches.length === 0) {
    return [];
  }

  const matchIds = filteredMatches.map((m) => m.id);

  const { data: snapshots, error: snapshotError } = await supabase
    .from("odds_snapshots")
    .select("match_id, bookmaker, market_key, outcome_name, odds")
    .in("match_id", matchIds);

  if (snapshotError) {
    throw new Error(`Supabase odds fetch error: ${snapshotError.message}`);
  }

  const byMatchId = new Map();

  for (const row of snapshots || []) {
    if (!byMatchId.has(row.match_id)) {
      byMatchId.set(row.match_id, []);
    }
    byMatchId.get(row.match_id).push(row);
  }

  return filteredMatches.map((match) =>
    formatDbGame(match, byMatchId.get(match.id) || [])
  );
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sportKey = searchParams.get("sportKey");

    if (!sportKey) {
      return NextResponse.json(
        { games: [], error: "Missing sportKey parameter" },
        { status: 400 }
      );
    }

    const cached = CACHE.get(sportKey);
    if (cached && Date.now() - cached.timestamp < CACHE_MS) {
      return NextResponse.json({
        games: cached.games,
        cached: true,
        lastUpdate: cached.timestamp,
        source: cached.source || "cache"
      });
    }

    const apiKey = process.env.ODDS_API_KEY;
    const hasSupabase =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!apiKey && !hasSupabase) {
      return NextResponse.json(
        { games: [], error: "ODDS_API_KEY ja Supabase envit puuttuvat" },
        { status: 500 }
      );
    }

    if (apiKey) {
      try {
        const url =
          `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/` +
          `?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;

        const res = await fetch(url, {
          next: { revalidate: 300 }
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message || `Odds API error for sportKey: ${sportKey}`);
        }

        if (!Array.isArray(data)) {
          throw new Error(`Unexpected API response for sportKey: ${sportKey}`);
        }

        const filtered = data.filter((g) =>
          isWithin3DaysInFinland(g.commence_time)
        );

        const games = filtered
          .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
          .slice(0, 50)
          .map(formatApiGame);

        let savedMatches = 0;
        let savedOdds = 0;

        if (hasSupabase) {
          const persisted = await persistGames(sportKey, games);
          savedMatches = persisted.savedMatches;
          savedOdds = persisted.savedOdds;
        }

        const now = Date.now();

        CACHE.set(sportKey, {
          timestamp: now,
          games,
          source: "api"
        });

        return NextResponse.json({
          games,
          cached: false,
          lastUpdate: now,
          savedMatches,
          savedOdds,
          source: "api"
        });
      } catch (apiError) {
        console.error("Primary Odds API failed, trying Supabase fallback:", apiError);
      }
    }

    if (!hasSupabase) {
      return NextResponse.json(
        {
          games: [],
          error: "Odds API epäonnistui eikä Supabase fallback ole käytössä"
        },
        { status: 500 }
      );
    }

    const fallbackGames = await loadGamesFromSupabase(sportKey);
    const now = Date.now();

    CACHE.set(sportKey, {
      timestamp: now,
      games: fallbackGames,
      source: "supabase_fallback"
    });

    return NextResponse.json({
      games: fallbackGames,
      cached: false,
      lastUpdate: now,
      savedMatches: 0,
      savedOdds: 0,
      source: "supabase_fallback",
      fallback: true
    });
  } catch (error) {
    console.error("games route error:", error);

    return NextResponse.json(
      {
        games: [],
        error: error.message || "Pelien haku epäonnistui"
      },
      { status: 500 }
    );
  }
}
