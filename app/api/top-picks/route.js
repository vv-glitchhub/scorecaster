import { getValueBet } from "../../../lib/value-model";

export const revalidate = 600; // 10 min cache

const TOP_LEAGUES = {
  icehockey: [
    "icehockey_liiga",
    "icehockey_nhl",
    "icehockey_sweden_hockey_league",
    "icehockey_allsvenskan",
  ],
  basketball: [
    "basketball_nba",
    "basketball_euroleague",
  ],
  soccer: [
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
  ],
  americanfootball: [
    "americanfootball_nfl",
  ],
};

const LEAGUE_LABELS = {
  icehockey_liiga: "Liiga",
  icehockey_nhl: "NHL",
  icehockey_sweden_hockey_league: "SHL",
  icehockey_allsvenskan: "Allsvenskan",
  basketball_nba: "NBA",
  basketball_euroleague: "EuroLeague",
  soccer_epl: "Premier League",
  soccer_spain_la_liga: "La Liga",
  soccer_italy_serie_a: "Serie A",
  americanfootball_nfl: "NFL",
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
  const minStart = now - 6 * 60 * 60 * 1000;
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
    `&regions=us,eu,uk` +
    `&markets=h2h` +
    `&oddsFormat=decimal` +
    `&dateFormat=iso`;

  const res = await fetch(url, {
    next: { revalidate: 600 },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !Array.isArray(data)) {
    return [];
  }

  return filterUpcomingGames(data, 3);
}

function buildTopPickEntry(game, leagueKey) {
  const bestBet = getValueBet(game);
  if (!bestBet) return null;

  return {
    gameId: game.id,
    leagueKey,
    leagueLabel: LEAGUE_LABELS[leagueKey] || leagueKey,
    home_team: game.home_team,
    away_team: game.away_team,
    commence_time: game.commence_time,
    outcome: bestBet.outcome,
    odds: bestBet.odds,
    bookmaker: bestBet.bookmaker,
    modelProb: bestBet.modelProb,
    marketProb: bestBet.marketProb,
    edge: bestBet.edge,
    ev: bestBet.ev,
    kelly: bestBet.kelly,
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const group = searchParams.get("group") || "icehockey";
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return Response.json({
        ok: false,
        reason: "missing_api_key",
        group,
        data: [],
      });
    }

    const leagues = TOP_LEAGUES[group] || TOP_LEAGUES.icehockey;

    const results = await Promise.all(
      leagues.map(async (leagueKey) => {
        const games = await fetchOddsForSport(leagueKey, apiKey);
        return { leagueKey, games };
      })
    );

    const allPicks = results
      .flatMap(({ leagueKey, games }) =>
        games
          .map((game) => buildTopPickEntry(game, leagueKey))
          .filter(Boolean)
      )
      .filter((pick) => Number.isFinite(pick.edge))
      .sort((a, b) => b.edge - a.edge)
      .slice(0, 3);

    return Response.json({
      ok: true,
      reason: null,
      group,
      data: allPicks,
    });
  } catch (error) {
    return Response.json({
      ok: false,
      reason: "server_error",
      error: String(error),
      data: [],
    });
  }
}
