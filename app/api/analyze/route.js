import { NextResponse } from "next/server";
import { buildQuickModel } from "../../../lib/model-engine-v1";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildValueBets } from "../../../lib/model/value-engine";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Use POST to analyze a match.",
  });
}

function inferSportGroupFromLeague(league) {
  if (!league) return "unknown";
  if (league.startsWith("icehockey")) return "icehockey";
  if (league.startsWith("basketball")) return "basketball";
  if (league.startsWith("soccer")) return "soccer";
  if (league.startsWith("americanfootball")) return "americanfootball";
  return "unknown";
}

function fallbackTeamStats(name, sport, league, isHome = false) {
  return {
    team: name,
    sport,
    league,
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
    xg_for_last_5: isHome ? 3.0 : 2.5,
    xg_against_last_5: isHome ? 2.4 : 2.8,
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

function normalizeTeamName(value) {
  return String(value || "").trim();
}

async function getTeamRatingFromDb({ teamName, sport, league }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const cleanTeamName = normalizeTeamName(teamName);

  // 1) Exact match ensin
  let query = supabase
    .from("team_ratings")
    .select("*")
    .eq("sport", sport)
    .eq("team", cleanTeamName);

  if (league && league !== "unknown") {
    query = query.eq("league", league);
  }

  const { data: exactRows, error: exactError } = await query.limit(1);

  if (exactError) {
    console.error("team_ratings exact fetch error:", exactError.message);
  }

  if (Array.isArray(exactRows) && exactRows.length > 0) {
    return exactRows[0];
  }

  // 2) Case-insensitive fallback
  let ilikeQuery = supabase
    .from("team_ratings")
    .select("*")
    .eq("sport", sport)
    .ilike("team", cleanTeamName);

  if (league && league !== "unknown") {
    ilikeQuery = ilikeQuery.eq("league", league);
  }

  const { data: ilikeRows, error: ilikeError } = await ilikeQuery.limit(1);

  if (ilikeError) {
    console.error("team_ratings ilike fetch error:", ilikeError.message);
    return null;
  }

  if (Array.isArray(ilikeRows) && ilikeRows.length > 0) {
    return ilikeRows[0];
  }

  return null;
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

    const league = match.sport_key || match.league || "unknown";
    const sport = inferSportGroupFromLeague(league);

    const [homeFromDb, awayFromDb] = await Promise.all([
      getTeamRatingFromDb({
        teamName: match.home_team,
        sport,
        league,
      }),
      getTeamRatingFromDb({
        teamName: match.away_team,
        sport,
        league,
      }),
    ]);

    const homeTeamStats =
      homeFromDb || fallbackTeamStats(match.home_team, sport, league, true);

    const awayTeamStats =
      awayFromDb || fallbackTeamStats(match.away_team, sport, league, false);

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
        sport,
        league,
      },
      analysis,
      debug: {
        homeLookupName: normalizeTeamName(match.home_team),
        awayLookupName: normalizeTeamName(match.away_team),
        homeFromDb: Boolean(homeFromDb),
        awayFromDb: Boolean(awayFromDb),
        homeDbTeam: homeFromDb?.team || null,
        awayDbTeam: awayFromDb?.team || null,
        modelVersion: analysis.modelVersion,
        homeXgAdjustment: analysis.homeXgAdjustment,
        awayXgAdjustment: analysis.awayXgAdjustment,
      },
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
