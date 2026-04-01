import { buildRoundRobinFixtures, simulateTournamentManyTimes } from "../../../lib/simulator";
import { DEFAULT_TEAM_RATINGS } from "../../../lib/team-ratings";

export async function GET() {
  try {
    const teams = Object.keys(DEFAULT_TEAM_RATINGS);
    const fixtures = buildRoundRobinFixtures(teams);

    const results = simulateTournamentManyTimes(
      teams,
      fixtures,
      5000,
      {
        customRatings: DEFAULT_TEAM_RATINGS,
        homeAdvantage: 0,
        fatigue: {},
        injuries: {},
      }
    );

    return Response.json({
      ok: true,
      teams,
      fixturesCount: fixtures.length,
      iterations: 5000,
      results,
    });
  } catch (error) {
    console.error("simulator route error:", error);

    return Response.json({
      ok: false,
      error: String(error),
      results: [],
    });
  }
}
