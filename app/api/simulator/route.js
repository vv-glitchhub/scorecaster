import { NextResponse } from "next/server";
import {
  DEFAULT_TEAM_DATA,
  RATING_WEIGHTS,
  getAllTeamRatings,
} from "../../../lib/team-ratings";
import { simulateWorldChampionshipManyTimes } from "../../../lib/simulator";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const iterations = Math.min(
      20000,
      Math.max(500, Number(searchParams.get("iterations") || 5000))
    );

    const teamRatings = getAllTeamRatings();

    const simulation = simulateWorldChampionshipManyTimes({
      teamRatings,
      iterations,
    });

    return NextResponse.json({
      ok: true,
      iterations,
      defaults: DEFAULT_TEAM_DATA,
      ratingWeights: RATING_WEIGHTS,
      teamCount: teamRatings.length,
      ...simulation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Simulator failed",
        details: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
