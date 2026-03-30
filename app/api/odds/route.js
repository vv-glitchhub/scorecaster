const SPORT_GROUP_LEAGUES = {
  icehockey: [
    "icehockey_liiga",
    "icehockey_nhl",
    "icehockey_allsvenskan",
    "icehockey_sweden_hockey_league",
    "icehockey_finland_mestis",
    "icehockey_germany_del",
    "icehockey_switzerland_nla",
    "icehockey_czech_extraliga",
    "icehockey", // fallback koko lajiin
  ],
  basketball: [
    "basketball_nba",
    "basketball_euroleague",
    "basketball_ncaab",
    "basketball",
  ],
  soccer: [
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
    "soccer_germany_bundesliga",
    "soccer_france_ligue_one",
    "soccer_finland_veikkausliiga",
    "soccer_uefa_champs_league",
    "soccer",
  ],
  americanfootball: [
    "americanfootball_nfl",
    "americanfootball_ncaaf",
    "americanfootball",
  ],
};

function normalizeBookmakers(bookmakers = []) {
  return bookmakers
    .map((bookmaker) => {
      const mergedOutcomes = [];

      for (const market of bookmaker.markets || []) {
        if (market?.key === "h2h" || market?.key === "h2h_3_way") {
          for (const outcome of market.outcomes || []) {
            if (
              outcome &&
              typeof outcome.name === "string" &&
              typeof outcome.price === "number"
            ) {
              mergedOutcomes.push({
                name: outcome.name,
                price: outcome.price,
              });
            }
          }
        }
      }

      if (!mergedOutcomes.length) return null;

      return {
        ...bookmaker,
        markets: [
          {
            key: "h2h",
            outcomes: mergedOutcomes,
          },
        ],
      };
    })
    .filter(Boolean);
}

function filterUpcomingGames(games, daysAhead = 3) {
  const now = Date.now();
  const minStart = now - 3 * 60 * 60 * 1000; // pieni negatiivinen puskuri jos peli alkaa pian
  const maxStart = now + daysAhead * 24 * 60 * 60 * 1000;

  return (games || [])
    .map((game) => ({
      ...game,
      bookmakers: normalizeBookmakers(game.bookmakers || []),
    }))
    .filter((game) => {
      const ts = new Date(game.commence_time).getTime();
      const hasOdds =
        Array.isArray(game.bookmakers) && game.bookmakers.length > 0;
      return Number.isFinite(ts) && ts >= minStart && ts <= maxStart && hasOdds;
    })
    .sort(
      (a, b) =>
        new Date(a.commence_time).getTime() -
        new Date(b.commence_time).getTime()
    );
}

async function fetchOddsForSport(sport, apiKey) {
  const url =
    `https://api.the-odds-api.com/v4/sports/${sport}/odds` +
    `?apiKey=${apiKey}` +
    `&regions=eu,uk,us` +
    `&markets=h2h,h2h_3_way` +
    `&oddsFormat=decimal` +
    `&dateFormat=iso`;

  const res = await fetch(url, {
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !Array.isArray(data)) {
    return {
      ok: false,
      sport,
      rawCount: Array.isArray(data) ? data.length : 0,
      filteredCount: 0,
      data: [],
      error: data || `HTTP ${res.status}`,
    };
  }

  const filtered = filterUpcomingGames(data, 3);

  return {
    ok: true,
    sport,
    rawCount: data.length,
    filteredCount: filtered.length,
    data: filtered,
    error: null,
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport") || "icehockey_liiga";
    const group = searchParams.get("group") || "icehockey";

    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return Response.json({
        fallback: false,
        reason: "missing_api_key",
        sport,
        group,
        sourceSport: null,
        rawCount: 0,
        filteredCount: 0,
        data: [],
      });
    }

    // 1) Valittu liiga ensin
    const primary = await fetchOddsForSport(sport, apiKey);

    if (primary.ok && primary.data.length > 0) {
      return Response.json({
        fallback: false,
        reason: null,
        sport,
        group,
        sourceSport: sport,
        rawCount: primary.rawCount,
        filteredCount: primary.filteredCount,
        data: primary.data,
      });
    }

    // 2) Muut saman lajin liigat + lopuksi koko laji
    const candidates = [...new Set((SPORT_GROUP_LEAGUES[group] || []).filter(Boolean))]
      .filter((leagueKey) => leagueKey !== sport);

    if (!candidates.length) {
      return Response.json({
        fallback: false,
        reason: "empty_live_data",
        sport,
        group,
        sourceSport: sport,
        rawCount: primary.rawCount || 0,
        filteredCount: 0,
        data: [],
      });
    }

    const results = await Promise.all(
      candidates.map((candidateSport) => fetchOddsForSport(candidateSport, apiKey))
    );

    const combined = results
      .filter((r) => r.ok && r.data.length > 0)
      .flatMap((r) =>
        r.data.map((game) => ({
          ...game,
          source_sport: r.sport,
        }))
      )
      .sort(
        (a, b) =>
          new Date(a.commence_time).getTime() -
          new Date(b.commence_time).getTime()
      );

    if (combined.length > 0) {
      return Response.json({
        fallback: false,
        reason: "used_next_available_game",
        sport,
        group,
        sourceSport: combined[0]?.source_sport || null,
        rawCount: primary.rawCount || 0,
        filteredCount: combined.length,
        data: combined.slice(0, 10), // näytä useampi peli, ei vain yhtä
      });
    }

    return Response.json({
      fallback: false,
      reason: "empty_live_data",
      sport,
      group,
      sourceSport: sport,
      rawCount: primary.rawCount || 0,
      filteredCount: 0,
      data: [],
    });
  } catch (error) {
    return Response.json({
      fallback: false,
      reason: "server_error",
      sport: null,
      group: null,
      sourceSport: null,
      rawCount: 0,
      filteredCount: 0,
      data: [],
      error: String(error),
    });
  }
}
