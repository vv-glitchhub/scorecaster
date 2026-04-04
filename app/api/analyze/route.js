import { NextResponse } from "next/server";
import { buildPrediction } from "@/lib/modelEngine";
import { getBestOddsByTeams } from "@/lib/getBestOddsByTeams";

function fallbackTeamRatings(teamName, side = "home") {
  return {
    team_name: teamName,
    rating: side === "home" ? 1520 : 1490,
    attack_rating: side === "home" ? 1.4 : 1.2,
    defense_rating: side === "home" ? 1.1 : 1.0,
    goalie_rating: side === "home" ? 1.0 : 0.9,
    form_last_5: side === "home" ? 1.3 : 0.8,
    fatigue_index: side === "home" ? 0.3 : 0.5,
    home_advantage: side === "home" ? 1.0 : 0,
    injuries_count: side === "home" ? 1 : 2,
    lineup_stability: side === "home" ? 1.2 : 0.9,
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { match, bankroll = 1000 } = body;

    if (!match) {
      return NextResponse.json({ error: "Missing match" }, { status: 400 });
    }

    const bestOdds = getBestOddsByTeams(
      match.bookmakers,
      match.home_team,
      match.away_team
    );

    const homeTeam = fallbackTeamRatings(match.home_team, "home");
    const awayTeam = fallbackTeamRatings(match.away_team, "away");

    const prediction = buildPrediction({
      homeTeam,
      awayTeam,
      bestOdds,
      bankroll,
      marketType: "h2h",
    });

    return NextResponse.json({
      match: {
        home_team: match.home_team,
        away_team: match.away_team,
        commence_time: match.commence_time,
      },
      bestOdds,
      prediction,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Analyze failed", details: error.message },
      { status: 500 }
    );
  }
}
