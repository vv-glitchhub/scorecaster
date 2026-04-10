import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { getModelProbabilitiesForMatch } from "../../../lib/model-engine-v1";
import { getTeamProfile } from "../../../lib/team-ratings";

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const homeTeam = searchParams.get("homeTeam") || "";
    const awayTeam = searchParams.get("awayTeam") || "";
    const sportKey = searchParams.get("sportKey") || "icehockey_liiga";

    if (!homeTeam || !awayTeam) {
      return NextResponse.json(
        { ok: false, error: "Missing homeTeam or awayTeam" },
        { status: 400 }
      );
    }

    const homeProfile = getTeamProfile(homeTeam);
    const awayProfile = getTeamProfile(awayTeam);

    const match = {
      id: `${homeTeam}-${awayTeam}`,
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: null,
      bookmakers: [],
    };

    const teamRatings = {
      [homeTeam]: {
        rating: safeNumber(homeProfile?.overallRating, 75),
      },
      [awayTeam]: {
        rating: safeNumber(awayProfile?.overallRating, 75),
      },
    };

    const model = await getModelProbabilitiesForMatch({
      match,
      oddsData: match,
      teamRatings,
    });

    let saved = null;

    if (supabaseAdmin) {
      const payload = {
        home_team: homeTeam,
        away_team: awayTeam,
        sport_key: sportKey,
        home_probability: safeNumber(model?.[homeTeam], null),
        away_probability: safeNumber(model?.[awayTeam], null),
        draw_probability: safeNumber(model?.Draw, null),
        debug: model?.debug ?? null,
      };

      const { data, error } = await supabaseAdmin
        .from("model_analysis_v1")
        .insert(payload)
        .select()
        .limit(1)
        .maybeSingle();

      if (!error) {
        saved = data;
      }
    }

    return NextResponse.json({
      ok: true,
      match: {
        homeTeam,
        awayTeam,
        sportKey,
      },
      model,
      saved,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "model-analysis-v1 failed",
        details: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
