import { supabaseAdmin } from "../../../lib/supabase-admin";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildMatchProbabilities(homeTeam, awayTeam, neutralVenue = true) {
  const homeAdvantage = neutralVenue ? 0 : 0.35;

  const homeStrength =
    homeTeam.attack * 0.30 +
    homeTeam.control_rating * 0.20 +
    homeTeam.defense * 0.20 +
    homeTeam.goalie * 0.15 +
    homeTeam.form * 0.15 +
    homeAdvantage;

  const awayStrength =
    awayTeam.attack * 0.30 +
    awayTeam.control_rating * 0.20 +
    awayTeam.defense * 0.20 +
    awayTeam.goalie * 0.15 +
    awayTeam.form * 0.15;

  const diff = homeStrength - awayStrength;

  let homeWin = 0.36 + diff * 0.055;
  let awayWin = 0.36 - diff * 0.055;
  let draw = 0.28 - Math.abs(diff) * 0.03;

  draw = clamp(draw, 0.12, 0.30);
  homeWin = clamp(homeWin, 0.10, 0.78);
  awayWin = clamp(awayWin, 0.10, 0.78);

  const total = homeWin + draw + awayWin;

  return {
    homeWin: homeWin / total,
    draw: draw / total,
    awayWin: awayWin / total,
    strengthDiff: diff,
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const home = searchParams.get("home");
    const away = searchParams.get("away");

    if (!home || !away) {
      return Response.json(
        { ok: false, error: "Missing home or away team" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("team_ratings")
      .select("*")
      .eq("sport", "football")
      .in("team", [home, away]);

    if (error) throw error;

    const rows = data || [];
    const homeTeam = rows.find((r) => r.team === home);
    const awayTeam = rows.find((r) => r.team === away);

    if (!homeTeam || !awayTeam) {
      return Response.json(
        { ok: false, error: "Missing stored ratings for one or both teams" },
        { status: 404 }
      );
    }

    const probabilities = buildMatchProbabilities(homeTeam, awayTeam, true);

    return Response.json({
      ok: true,
      homeTeam,
      awayTeam,
      probabilities,
      explanation: {
        homeAttack: homeTeam.attack,
        awayAttack: awayTeam.attack,
        homeControl: homeTeam.control_rating,
        awayControl: awayTeam.control_rating,
        homeDefense: homeTeam.defense,
        awayDefense: awayTeam.defense,
        homeGoalie: homeTeam.goalie,
        awayGoalie: awayTeam.goalie,
        homeForm: homeTeam.form,
        awayForm: awayTeam.form,
      },
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
