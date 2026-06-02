import { SPORTS } from "../../../lib/sports";
import { createTopPicksFromGames } from "../../../lib/scorecaster-engine";

const DEFAULT_LEAGUES = [
  "icehockey_nhl",
  "basketball_nba",
  "basketball_wnba",
  "soccer_fifa_world_cup",
  "soccer_sweden_allsvenskan",
  "soccer_norway_eliteserien"
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
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.games)) return data.games;
  return [];
}

export async function GET(request) {
  const { origin } = new URL(request.url);
  const allPicks = [];

  for (const league of DEFAULT_LEAGUES) {
    try {
      const response = await fetch(
        `${origin}/api/odds?sport=${league}&markets=h2h`,
        { cache: "no-store" }
      );

      const data = await response.json();
      const games = getGamesFromResponse(data);

      const picks = createTopPicksFromGames({
        games,
        marketKey: "h2h",
        bankroll: 1000,
        kellyMode: "quarter",
        minEdge: 0.01,
        limit: 10
      }).map((pick) => ({
        ...pick,
        league,
        leagueTitle: findLeagueTitle(league)
      }));

      allPicks.push(...picks);
    } catch {
      // Skip failed league
    }
  }

  const sorted = allPicks.sort((a, b) => b.edge - a.edge).slice(0, 20);

  return Response.json({
    ok: true,
    source: "scorecaster-engine-v1",
    count: sorted.length,
    data: sorted
  });
}
