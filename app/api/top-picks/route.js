import { analyzeBet } from "../../../lib/analysis-engine";
import { SPORTS } from "../../../lib/sports";

const DEFAULT_LEAGUES = [
  "icehockey_nhl",
  "basketball_nba",
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga"
];

function flattenLeagues() {
  return SPORTS.flatMap((group) => group.leagues);
}

function findLeagueTitle(key) {
  return flattenLeagues().find((league) => league.key === key)?.title || key;
}

function getGamesFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  const allPicks = [];

  for (const league of DEFAULT_LEAGUES) {
    try {
      const response = await fetch(
        `${baseUrl}/api/odds?sport=${league}&markets=h2h`,
        { cache: "no-store" }
      );

      const data = await response.json();
      const games = getGamesFromResponse(data);

      for (const game of games.slice(0, 5)) {
        const bookmaker = game.bookmakers?.[0];
        const market = bookmaker?.markets?.find((m) => m.key === "h2h");
        const outcomes = market?.outcomes || [];

        for (const outcome of outcomes) {
          const odds = Number(outcome.price);
          const modelProbability = 0.55;

          const analysis = analyzeBet({
            selection: outcome.name,
            decimalOdds: odds,
            modelProbability,
            volatility: "medium",
            bankroll: 1000
          });

          if (analysis.edge > 0) {
            allPicks.push({
              league,
              leagueTitle: findLeagueTitle(league),
              match: `${game.home_team || outcomes[0]?.name} vs ${
                game.away_team || outcomes[1]?.name
              }`,
              selection: outcome.name,
              odds,
              edge: analysis.edge,
              ev: analysis.ev,
              confidence: analysis.confidence
            });
          }
        }
      }
    } catch {
      // Skip failed league
    }
  }

  const sorted = allPicks
    .sort((a, b) => b.edge - a.edge)
    .slice(0, 10);

  return Response.json({
    ok: true,
    source: "top-picks-v1",
    count: sorted.length,
    data: sorted
  });
}
