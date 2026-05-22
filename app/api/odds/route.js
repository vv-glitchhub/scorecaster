import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4/sports";

const SPORT_MAP = {
  icehockey: {
    NHL: "icehockey_nhl",
    LIIGA: "icehockey_liiga",
    SHL: "icehockey_sweden_hockey_league",
  },
  soccer: {
    EPL: "soccer_epl",
    "Premier League": "soccer_epl",
    UCL: "soccer_uefa_champs_league",
    "La Liga": "soccer_spain_la_liga",
    SerieA: "soccer_italy_serie_a",
    Bundesliga: "soccer_germany_bundesliga",
    Ligue1: "soccer_france_ligue_one",
  },
  basketball: {
    NBA: "basketball_nba",
    EuroLeague: "basketball_euroleague",
  },
  football: {
    NFL: "americanfootball_nfl",
  },
  baseball: {
    MLB: "baseball_mlb",
  },
  tennis: {
    ATP: "tennis_atp",
    WTA: "tennis_wta",
  },
  mma: {
    UFC: "mma_mixed_martial_arts",
  },
  golf: {
    PGA: "golf_pga_championship_winner",
  },
};

function demoMatches() {
  const now = Date.now();

  return [
    {
      id: "demo-nhl-1",
      source: "demo",
      sport_key: "icehockey_nhl",
      sport_title: "NHL",
      commence_time: new Date(now + 1000 * 60 * 60 * 3).toISOString(),
      home_team: "Buffalo Sabres",
      away_team: "Montreal Canadiens",
      bestOdds: {
        home: 2.31,
        draw: 4.3,
        away: 2.8,
        over: 1.91,
        under: 1.91,
        point: 5.5,
        spreadHome: 1.86,
        spreadAway: 1.96,
        spreadPointHome: -1.5,
        spreadPointAway: 1.5,
        books: {
          home: "Coolbet",
          draw: "Paf",
          away: "Unibet",
          over: "Coolbet",
          under: "Paf",
          spreadHome: "Unibet",
          spreadAway: "Coolbet",
        },
        bookPrices: {
          home: [{ bookmaker: "Coolbet", odds: 2.31 }],
          draw: [{ bookmaker: "Paf", odds: 4.3 }],
          away: [{ bookmaker: "Unibet", odds: 2.8 }],
          over: [{ bookmaker: "Coolbet", odds: 1.91 }],
          under: [{ bookmaker: "Paf", odds: 1.91 }],
          spreadHome: [{ bookmaker: "Unibet", odds: 1.86 }],
          spreadAway: [{ bookmaker: "Coolbet", odds: 1.96 }],
        },
      },
    },
    {
      id: "demo-liiga-1",
      source: "demo",
      sport_key: "icehockey_liiga",
      sport_title: "Liiga",
      commence_time: new Date(now + 1000 * 60 * 60 * 5).toISOString(),
      home_team: "Tappara",
      away_team: "Ilves",
      bestOdds: {
        home: 2.15,
        draw: 4.05,
        away: 2.95,
        over: 1.88,
        under: 1.95,
        point: 5.5,
        spreadHome: 1.9,
        spreadAway: 1.9,
        spreadPointHome: -1.5,
        spreadPointAway: 1.5,
        books: {
          home: "Coolbet",
          draw: "Veikkaus",
          away: "Paf",
          over: "Unibet",
          under: "Coolbet",
          spreadHome: "Paf",
          spreadAway: "Coolbet",
        },
        bookPrices: {
          home: [{ bookmaker: "Coolbet", odds: 2.15 }],
          draw: [{ bookmaker: "Veikkaus", odds: 4.05 }],
          away: [{ bookmaker: "Paf", odds: 2.95 }],
          over: [{ bookmaker: "Unibet", odds: 1.88 }],
          under: [{ bookmaker: "Coolbet", odds: 1.95 }],
          spreadHome: [{ bookmaker: "Paf", odds: 1.9 }],
          spreadAway: [{ bookmaker: "Coolbet", odds: 1.9 }],
        },
      },
    },
    {
      id: "demo-soccer-1",
      source: "demo",
      sport_key: "soccer_epl",
      sport_title: "Premier League",
      commence_time: new Date(now + 1000 * 60 * 60 * 8).toISOString(),
      home_team: "Arsenal",
      away_team: "Liverpool",
      bestOdds: {
        home: 2.42,
        draw: 3.55,
        away: 2.9,
        over: 1.82,
        under: 2.05,
        point: 2.5,
        spreadHome: 1.91,
        spreadAway: 1.91,
        spreadPointHome: -0.5,
        spreadPointAway: 0.5,
        books: {
          home: "Unibet",
          draw: "Coolbet",
          away: "Paf",
          over: "Coolbet",
          under: "Unibet",
          spreadHome: "Paf",
          spreadAway: "Coolbet",
        },
        bookPrices: {
          home: [{ bookmaker: "Unibet", odds: 2.42 }],
          draw: [{ bookmaker: "Coolbet", odds: 3.55 }],
          away: [{ bookmaker: "Paf", odds: 2.9 }],
          over: [{ bookmaker: "Coolbet", odds: 1.82 }],
          under: [{ bookmaker: "Unibet", odds: 2.05 }],
          spreadHome: [{ bookmaker: "Paf", odds: 1.91 }],
          spreadAway: [{ bookmaker: "Coolbet", odds: 1.91 }],
        },
      },
    },
  ];
}

function getSportKeys(sport, league) {
  if (sport === "all") {
    return [
      "icehockey_nhl",
      "basketball_nba",
      "soccer_epl",
      "americanfootball_nfl",
    ];
  }

  const group = SPORT_MAP[sport];

  if (!group) return ["icehockey_nhl"];

  if (league && league !== "ALL") {
    return [group[league] || group[String(league).toUpperCase()] || Object.values(group)[0]];
  }

  return Object.values(group);
}

function pickBest(current, candidate) {
  const c = Number(candidate?.odds || candidate?.price || 0);
  const n = Number(current?.odds || 0);

  if (!Number.isFinite(c) || c <= 1) return current;
  if (!current || c > n) return candidate;

  return current;
}

function normalizeOddsApiEvent(event) {
  const best = {
    bookPrices: {},
    books: {},
  };

  for (const bookmaker of event.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key === "h2h") {
        for (const outcome of market.outcomes || []) {
          const name = String(outcome.name || "").toLowerCase();
          let key = null;

          if (name === String(event.home_team || "").toLowerCase()) key = "home";
          else if (name === String(event.away_team || "").toLowerCase()) key = "away";
          else if (name === "draw" || name === "tie" || name === "tasapeli") key = "draw";

          if (key) {
            best.bookPrices[key] ||= [];
            best.bookPrices[key].push({
              bookmaker: bookmaker.title || bookmaker.key,
              odds: outcome.price,
            });

            const current = best[key]
              ? { odds: best[key], bookmaker: best.books[key] }
              : null;

            const winner = pickBest(current, {
              bookmaker: bookmaker.title || bookmaker.key,
              odds: outcome.price,
            });

            best[key] = winner?.odds;
            best.books[key] = winner?.bookmaker;
          }
        }
      }

      if (market.key === "totals") {
        for (const outcome of market.outcomes || []) {
          const key = String(outcome.name || "").toLowerCase() === "over" ? "over" : "under";

          best.point = outcome.point ?? best.point;

          best.bookPrices[key] ||= [];
          best.bookPrices[key].push({
            bookmaker: bookmaker.title || bookmaker.key,
            odds: outcome.price,
            point: outcome.point,
          });

          const current = best[key]
            ? { odds: best[key], bookmaker: best.books[key] }
            : null;

          const winner = pickBest(current, {
            bookmaker: bookmaker.title || bookmaker.key,
            odds: outcome.price,
          });

          best[key] = winner?.odds;
          best.books[key] = winner?.bookmaker;
        }
      }

      if (market.key === "spreads") {
        for (const outcome of market.outcomes || []) {
          const name = String(outcome.name || "").toLowerCase();
          let key = null;

          if (name === String(event.home_team || "").toLowerCase()) key = "spreadHome";
          if (name === String(event.away_team || "").toLowerCase()) key = "spreadAway";

          if (key) {
            if (key === "spreadHome") best.spreadPointHome = outcome.point;
            if (key === "spreadAway") best.spreadPointAway = outcome.point;

            best.bookPrices[key] ||= [];
            best.bookPrices[key].push({
              bookmaker: bookmaker.title || bookmaker.key,
              odds: outcome.price,
              point: outcome.point,
            });

            const current = best[key]
              ? { odds: best[key], bookmaker: best.books[key] }
              : null;

            const winner = pickBest(current, {
              bookmaker: bookmaker.title || bookmaker.key,
              odds: outcome.price,
            });

            best[key] = winner?.odds;
            best.books[key] = winner?.bookmaker;
          }
        }
      }
    }
  }

  return {
    id: event.id,
    source: "the-odds-api",
    sport_key: event.sport_key,
    sport_title: event.sport_title,
    commence_time: event.commence_time,
    home_team: event.home_team,
    away_team: event.away_team,
    bookmakers: event.bookmakers || [],
    bestOdds: best,
  };
}

function hasBettableOdds(match) {
  return Boolean(
    match?.bestOdds?.home ||
      match?.bestOdds?.away ||
      match?.bestOdds?.over ||
      match?.bestOdds?.under ||
      match?.bestOdds?.spreadHome ||
      match?.bestOdds?.spreadAway
  );
}

async function fetchLeagueOdds(sportKey, apiKey) {
  const url = new URL(`${ODDS_API_BASE}/${sportKey}/odds`);

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "eu,us");
  url.searchParams.set("markets", "h2h,totals,spreads");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    return {
      ok: false,
      sportKey,
      status: res.status,
      error: text,
      matches: [],
    };
  }

  const json = JSON.parse(text);

  return {
    ok: true,
    sportKey,
    status: res.status,
    rawCount: Array.isArray(json) ? json.length : 0,
    matches: Array.isArray(json) ? json.map(normalizeOddsApiEvent) : [],
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const requestedSport = searchParams.get("sport") || "icehockey";
  const requestedLeague = searchParams.get("league") || "NHL";
  const requestedStatus = searchParams.get("status") || "upcoming";
  const force = searchParams.get("force") === "1";

  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      source: "fallback",
      status: "demo",
      provider: "local-demo",
      cached: false,
      reason: "ODDS_API_KEY puuttuu. Näytetään demo-data.",
      matches: demoMatches(),
      debug: {
        requestedSport,
        requestedLeague,
        requestedStatus,
        hasOddsApiKey: false,
        force,
      },
    });
  }

  const sportKeys = getSportKeys(requestedSport, requestedLeague);
  const results = [];

  for (const sportKey of sportKeys) {
    const result = await fetchLeagueOdds(sportKey, apiKey);
    results.push(result);
  }

  const matches = results
    .flatMap((result) => result.matches || [])
    .filter(hasBettableOdds);

  const quotaError = results.some((result) =>
    String(result.error || "").includes("OUT_OF_USAGE_CREDITS")
  );

  const invalidKey = results.some((result) =>
    String(result.error || "").includes("INVALID_KEY")
  );

  if (matches.length > 0) {
    return NextResponse.json({
      source: "live",
      status: "fresh",
      provider: "the-odds-api",
      cached: false,
      reason: "",
      matches,
      debug: {
        requestedSport,
        requestedLeague,
        requestedStatus,
        searchedLeagues: sportKeys,
        hasOddsApiKey: true,
        results,
        bettableCount: matches.length,
      },
    });
  }

  if (quotaError || invalidKey) {
    return NextResponse.json({
      source: "fallback",
      status: "demo",
      provider: "local-demo",
      cached: false,
      reason: quotaError
        ? "The Odds API krediitit loppuivat. Näytetään demo-data, jotta sovellus toimii."
        : "The Odds API avain ei toimi. Näytetään demo-data.",
      matches: demoMatches(),
      debug: {
        requestedSport,
        requestedLeague,
        requestedStatus,
        searchedLeagues: sportKeys,
        hasOddsApiKey: true,
        results,
        quotaError,
        invalidKey,
        bettableCount: 0,
      },
    });
  }

  return NextResponse.json({
    source: "fallback",
    status: "demo",
    provider: "local-demo",
    cached: false,
    reason:
      "The Odds API ei palauttanut kertoimellisiä tulevia otteluita. Näytetään demo-data.",
    matches: demoMatches(),
    debug: {
      requestedSport,
      requestedLeague,
      requestedStatus,
      searchedLeagues: sportKeys,
      hasOddsApiKey: true,
      results,
      bettableCount: 0,
    },
  });
}
