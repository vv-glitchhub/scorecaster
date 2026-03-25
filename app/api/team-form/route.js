import { NextResponse } from "next/server";

function fallbackTeamForm(team, sport = null) {
  return {
    team,
    sport: sport || "unknown",
    last5: ["N/A", "N/A", "N/A", "N/A", "N/A"],
    formScore: 5.0,
    attackRating: 5.0,
    defenseRating: 5.0,
    momentum: "unknown",
    notes: "No specific team form data available yet."
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const team = searchParams.get("team");
    const sport = searchParams.get("sport");

    if (!team) {
      return NextResponse.json(
        { error: "Missing team parameter" },
        { status: 400 }
      );
    }

    return NextResponse.json(fallbackTeamForm(team, sport));
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch team form" },
      { status: 500 }
    );
  }
}
