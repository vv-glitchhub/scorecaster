import { SPORTS } from "../../../lib/sports";
import { createTopPicksFromGames } from "../../../lib/scorecaster-engine";
import { enrichPickWithLiveIntelligence } from "../../../lib/agent-intelligence-loader";

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

function rankPick(pick) {
  const decisionWeight = {
    BET: 1,
    WATCH: 0.5,
    WAIT: 0.15,
    PASS: -1
  };

  return (
    Number(pick.finalScore || 0) +
    Number(pick.edge || 0) +
    Number(pick.sentimentScore || 0) +
    Number(pick.sourceTrust || 0) * 0.02 +
    Number(decisionWeight[pick.decision] || 0)
  );
}

async function enrichSafely(pick) {
  try {
    return await enrichPickWithLiveIntelligence(pick);
  } catch (error) {
    return {
      ...pick,
      agentVersion: "fallback",
      decision: pick.edge > 0.05 ? "WATCH" : "PASS",
      finalScore: Number(pick.finalScore || pick.edge || 0),
      intelligenceError: error.message
    };
  }
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
        leagueTitle: findLeagueTitle(league),
        sportKey: league
      }));

      allPicks.push(...picks);
    } catch {
      // Skip failed league
    }
  }

  const preFiltered = allPicks
    .sort((a, b) => Number(b.edge || 0) - Number(a.edge || 0))
    .slice(0, 25);

  const enriched = await Promise.all(preFiltered.map(enrichSafely));

  const sorted = enriched
    .sort((a, b) => rankPick(b) - rankPick(a))
    .slice(0, 20);

  return Response.json({
    ok: true,
    source: "agent-v7-top-picks",
    agentVersion: "V7",
    count: sorted.length,
    data: sorted
  });
}
