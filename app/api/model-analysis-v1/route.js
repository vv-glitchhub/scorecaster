import { supabaseAdmin } from "../../../lib/supabase-admin";
import { buildQuickModel } from "../../../lib/model-engine-v1";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const sport = searchParams.get("sport");
    const league = searchParams.get("league");
    const homeTeam = searchParams.get("home");
    const awayTeam = searchParams.get("away");
    const matchId =
      searchParams.get("matchId") ||
      `${sport || "unknown"}-${league || "unknown"}-${homeTeam || "home"}-${awayTeam || "away"}`;

    if (!sport || !league || !homeTeam || !awayTeam) {
      return Response.json(
        {
          ok: false,
          error: "Missing required params: sport, league, home, away",
        },
        { status: 400 }
      );
    }

    const [{ data: teamRows, error: teamError }, { data: playerRows, error: playerError }, { data: contextRow, error: contextError }, { data: oddsRows, error: oddsError }] =
      await Promise.all([
        supabaseAdmin
          .from("team_model_stats")
          .select("*")
          .eq("sport", sport)
          .eq("league", league)
          .in("team", [homeTeam, awayTeam]),

        supabaseAdmin
          .from("player_model_stats")
          .select("*")
          .eq("sport", sport)
          .eq("league", league)
          .in("team", [homeTeam, awayTeam]),

        supabaseAdmin
          .from("match_context_snapshots")
          .select("*")
          .eq("match_id", matchId)
          .maybeSingle(),

        supabaseAdmin
          .from("odds_market_cache")
          .select("*")
          .eq("sport", sport)
          .eq("league", league)
          .eq("home_team", homeTeam)
          .eq("away_team", awayTeam),
      ]);

    if (teamError) throw teamError;
    if (playerError) throw playerError;
    if (contextError) throw contextError;
    if (oddsError) throw oddsError;

    const homeTeamStats = (teamRows || []).find((t) => t.team === homeTeam);
    const awayTeamStats = (teamRows || []).find((t) => t.team === awayTeam);

    if (!homeTeamStats || !awayTeamStats) {
      return Response.json(
        {
          ok: false,
          error: "Missing team_model_stats for one or both teams",
        },
        { status: 404 }
      );
    }

    const homePlayers = (playerRows || []).filter((p) => p.team === homeTeam);
    const awayPlayers = (playerRows || []).filter((p) => p.team === awayTeam);

    const context =
      contextRow || {
        match_id: matchId,
        sport,
        league,
        home_team: homeTeam,
        away_team: awayTeam,
        rest_days_home: 2,
        rest_days_away: 2,
        schedule_load_7d_home: 2,
        schedule_load_7d_away: 2,
        travel_km_7d_home: 0,
        travel_km_7d_away: 0,
        timezone_penalty_home: 0,
        timezone_penalty_away: 0,
        home_away_flag: true,
        opponent_strength_home: 50,
        opponent_strength_away: 50,
      };

    const result = buildQuickModel({
      homeTeamStats,
      awayTeamStats,
      homePlayers,
      awayPlayers,
      context,
      oddsRows: oddsRows || [],
    });

    const outputRow = {
      match_id: matchId,
      sport,
      league,
      home_team: homeTeam,
      away_team: awayTeam,
      model_version: result.modelVersion,
      home_base_strength: result.homeBaseStrength,
      away_base_strength: result.awayBaseStrength,
      home_context_adjustment: result.homeContextAdjustment,
      away_context_adjustment: result.awayContextAdjustment,
      home_player_adjustment: result.homePlayerAdjustment,
      away_player_adjustment: result.awayPlayerAdjustment,
      home_final_strength: result.homeFinalStrength,
      away_final_strength: result.awayFinalStrength,
      home_win_probability: result.homeWinProbability,
      away_win_probability: result.awayWinProbability,
      best_home_odds: result.bestHomeOdds,
      best_away_odds: result.bestAwayOdds,
      market_home_probability: result.marketHomeProbability,
      market_away_probability: result.marketAwayProbability,
      edge_home: result.edgeHome,
      edge_away: result.edgeAway,
      ev_home: result.evHome,
      ev_away: result.evAway,
      kelly_home: result.kellyHome,
      kelly_away: result.kellyAway,
      updated_at: new Date().toISOString(),
    };

    const { error: outputError } = await supabaseAdmin
      .from("match_model_outputs")
      .upsert(outputRow, {
        onConflict: "match_id,model_version",
      });

    if (outputError) throw outputError;

    return Response.json({
      ok: true,
      matchId,
      context,
      homeTeamStats,
      awayTeamStats,
      homePlayersCount: homePlayers.length,
      awayPlayersCount: awayPlayers.length,
      oddsRowsCount: (oddsRows || []).length,
      result,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
