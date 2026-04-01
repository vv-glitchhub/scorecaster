import { getValueBet } from "../../../lib/value-model";

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

const LEAGUE_LABELS = {
  icehockey_liiga: "Liiga",
  icehockey_nhl: "NHL",
  icehockey_allsvenskan: "Allsvenskan",
  icehockey_sweden_hockey_league: "SHL",
  icehockey_finland_mestis: "Mestis",
  icehockey_germany_del: "DEL",
  icehockey_switzerland_nla: "National League",
  icehockey_czech_extraliga: "Extraliga",
  basketball_nba: "NBA",
  basketball_euroleague: "EuroLeague",
  basketball_ncaab: "NCAA",
  soccer_epl: "Premier League",
  soccer_spain_la_liga: "La Liga",
  soccer_italy_serie_a: "Serie A",
  soccer_germany_bundesliga: "Bundesliga",
  soccer_france_ligue_one: "Ligue 1",
  soccer_finland_veikkausliiga: "Veikkausliiga",
  soccer_uefa_champs_league: "Champions League",
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "NCAA Football",
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
        markets: [{ key: "h2h", outcomes: mergedOutcomes }],
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

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, sport, data: [], error: data || `HTTP ${res.status}` };
  }

  if (!Array.isArray(data)) {
    return { ok: false, sport, data: [], error: "Response was not an array" };
  }

  return {
    ok: true,
    sport,
    data: filterUpcomingGames(data, 3),
    error: null,
  };
}

function buildPick(game, leagueKey) {
  const valueBet = getValueBet(game);
  if (!valueBet) return null;

  return {
    id: `${leagueKey}-${game.id}-${valueBet.outcome}`,
    gameId: game.id,
    leagueKey,
    leagueLabel: LEAGUE_LABELS[leagueKey] || leagueKey,
    home_team: game.home_team,
    away_team: game.away_team,
    commence_time: game.commence_time,
    outcome: valueBet.outcome,
    bookmaker: valueBet.bookmaker,
    odds: valueBet.odds,
    modelProb: valueBet.modelProb,
    marketProb: valueBet.marketProb,
    edge: valueBet.edge,
    ev: valueBet.ev,
    kelly: valueBet.kelly,
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
        data: [],
      });
    }

    const leagues = SPORT_GROUP_LEAGUES[group] || SPORT_GROUP_LEAGUES.icehockey;

    const results = await Promise.all(
      leagues.map((leagueKey) => fetchOddsForSport(leagueKey, apiKey))
    );

    const picks = results
      .filter((result) => result.ok)
      .flatMap((result) =>
        result.data.map((game) => buildPick(game, result.sport)).filter(Boolean)
      )
      .filter((pick) => Number.isFinite(pick.edge) && Number.isFinite(pick.ev))
      .sort((a, b) => {
        if (b.edge !== a.edge) return b.edge - a.edge;
        return b.ev - a.ev;
      })
      .slice(0, 3);

    return Response.json({
      ok: true,
      reason: null,
      data: picks,
    });
  } catch (error) {
    console.error("top-picks route error:", error);

    return Response.json({
      ok: false,
      reason: "server_error",
      data: [],
    });
  }
}
