import { NextResponse } from "next/server";
import { buildQuickModel } from "../../../lib/model-engine-v1";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Use POST to analyze a match.",
  });
}

function fallbackTeamStats(name, isHome = false) {
  return {
    team_name: name,
    rating: isHome ? 58 : 54,
    form_last_5: isHome ? 56 : 50,
    attack_rating: isHome ? 57 : 52,
    defense_rating: isHome ? 55 : 51,
    goalie_rating: isHome ? 56 : 50,
    lineup_stability: isHome ? 60 : 54,
    strength_of_schedule: 50,
    home_advantage: isHome ? 4 : 0,
    fatigue_index: isHome ? 2 : 3,
    injuries_count: isHome ? 1 : 2,
  };
}

function mapOddsRowsFromBookmakers(bookmakers = []) {
  return bookmakers.flatMap((bookmaker) =>
    (bookmaker.markets || []).flatMap((market) => {
      if (market.key !== "h2h") return [];

      return (market.outcomes || []).map((outcome) => ({
        bookmaker: bookmaker.title,
        market: market.key,
        outcome_name: outcome.name,
        odds: outcome.price,
      }));
    })
  );
}

function buildFallbackContext(match) {
  return {
    home_team: match.home_team,
    away_team: match.away_team,
    rest_days_home: 2,
    rest_days_away: 2,
    schedule_load_7d_home: 2,
    schedule_load_7d_away: 2,
    travel_km_7d_home: 0,
    travel_km_7d_away: 200,
    timezone_penalty_home: 0,
    timezone_penalty_away: 0,
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { match } = body;

    if (!match?.home_team || !match?.away_team) {
      return NextResponse.json(
        { error: "Missing match.home_team or match.away_team" },
        { status: 400 }
      );
    }

    const homeTeamStats = fallbackTeamStats(match.home_team, true);
    const awayTeamStats = fallbackTeamStats(match.away_team, false);
    const oddsRows = mapOddsRowsFromBookmakers(match.bookmakers || []);
    const context = buildFallbackContext(match);

    const analysis = buildQuickModel({
      homeTeamStats,
      awayTeamStats,
      homePlayers: [],
      awayPlayers: [],
      context,
      oddsRows,
    });

    return NextResponse.json({
      match: {
        id: match.id ?? null,
        home_team: match.home_team,
        away_team: match.away_team,
        commence_time: match.commence_time ?? null,
      },
      analysis,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Analyze failed",
        details: error?.message || "Unknown server error",
      },
      { status: 500 }
    );
  }
}
