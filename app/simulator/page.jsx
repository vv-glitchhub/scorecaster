import {
  DEFAULT_TEAM_DATA,
  RATING_WEIGHTS,
  getAllTeamRatings,
} from "../../../lib/team-ratings";
import { simulateWorldChampionshipManyTimes } from "../../../lib/simulator";

export async function GET() {
  try {
    const iterations = 5000;
    const results = simulateWorldChampionshipManyTimes(
      iterations,
      DEFAULT_TEAM_DATA
    );

    const teamRatings = getAllTeamRatings(DEFAULT_TEAM_DATA);

    return Response.json({
      ok: true,
      tournament: "IIHF World Championship",
      iterations,
      meta: {
        includes: [
          "joukkueiden hyökkäysarvio",
          "joukkueiden puolustusarvio",
          "maalivahtivaikutus",
          "joukkueen nykyinen formi",
          "lohkovaihe, puolivälierät, välierät, finaali ja pronssiottelu",
        ],
        excludes: [
          "viime hetken loukkaantumiset",
          "todelliset kisakokoonpanot",
          "matkustuskuorma",
          "markkinafutures-kertoimet",
          "valmennuksen taktiset erot",
        ],
        ratingFormula: {
          attackWeight: RATING_WEIGHTS.attack,
          defenseWeight: RATING_WEIGHTS.defense,
          goalieWeight: RATING_WEIGHTS.goalie,
          formWeight: RATING_WEIGHTS.form,
        },
      },
      teamRatings,
      results,
    });
  } catch (error) {
    console.error("simulator route error:", error);

    return Response.json({
      ok: false,
      error: String(error),
      teamRatings: [],
      results: [],
    });
  }
}
