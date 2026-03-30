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
  ],
  basketball: [
    "basketball_nba",
    "basketball_euroleague",
    "basketball_ncaab",
  ],
  soccer: [
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
    "soccer_germany_bundesliga",
    "soccer_france_ligue_one",
    "soccer_finland_veikkausliiga",
    "soccer_uefa_champs_league",
  ],
  americanfootball: [
    "americanfootball_nfl",
    "americanfootball_ncaaf",
  ],
};

function filterUpcomingGames(games, daysAhead = 7) {
  const now = Date.now();
  const minStart = now + 15 * 60 * 1000;
  const maxStart = now + daysAhead * 24 * 60 * 60 * 1000;

  return (games || [])
    .filter((game) => {
      const ts = new Date(game.commence_time).getTime();
      return Number.isFinite(ts) && ts >= minStart && ts <= maxStart;
    })
    .sort(
      (a, b) =>
        new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
    );
}

async function fetchOddsForSport(sport, apiKey) {
  const url =
    `https://api.the-odds-api.com/v4/sports/${sport}/odds` +
    `?apiKey=${apiKey}` +
    `&regions=eu,us` +
    `&markets=h2h` +
    `&oddsFormat=decimal` +
    `&dateFormat=iso`;

  const res = await fetch(url, {
    next: { revalidate: 300 },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !Array.isArray(data)) {
    return {
      ok: false,
      sport,
      data: [],
      error: data || `HTTP ${res.status}`,
    };
  }

  return {
    ok: true,
    sport,
    data: filterUpcomingGames(data, 7),
    error: null,
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport") || "icehockey_liiga";
    const group = searchParams.get("group") || "icehockey";

    if (!process.env.ODDS_API_KEY) {
      return Response.json(
        {
          fallback: false,
          reason: "missing_api_key",
          sport,
          group,
          data: [],
        },
        { status: 200 }
      );
    }

    // 1) Yritä ensin valitun liigan omat pelit
    const primary = await fetchOddsForSport(sport, process.env.ODDS_API_KEY);

    if (primary.ok && primary.data.length > 0) {
      return Response.json({
        fallback: false,
        reason: null,
        sport,
        group,
        sourceSport: sport,
        data: primary.data,
      });
    }

    // 2) Jos ei löytynyt, hae seuraava oikea peli saman lajin muista liigoista
    const candidates = (SPORT_GROUP_LEAGUES[group] || []).filter((key) => key !== sport);

    if (candidates.length === 0) {
      return Response.json({
        fallback: false,
        reason: "empty_live_data",
        sport,
        group,
        sourceSport: sport,
        data: [],
      });
    }

    const results = await Promise.all(
      candidates.map((candidateSport) =>
        fetchOddsForSport(candidateSport, process.env.ODDS_API_KEY)
      )
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
          new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
      );

    if (combined.length > 0) {
      const nextGameTime = combined[0].commence_time;
      const sameTimeGames = combined.filter(
        (g) => new Date(g.commence_time).getTime() === new Date(nextGameTime).getTime()
      );

      return Response.json({
        fallback: false,
        reason: "used_next_available_game",
        sport,
        group,
        sourceSport: sameTimeGames[0]?.source_sport || null,
        data: sameTimeGames,
      });
    }

    return Response.json({
      fallback: false,
      reason: "empty_live_data",
      sport,
      group,
      sourceSport: sport,
      data: [],
    });
  } catch (error) {
    return Response.json({
      fallback: false,
      reason: "server_error",
      sport: null,
      group: null,
      sourceSport: null,
      data: [],
      error: String(error),
    });
  }
}
