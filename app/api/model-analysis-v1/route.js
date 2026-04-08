import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { buildQuickModel } from "../../../lib/model-engine-v1";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const homeTeam = searchParams.get("homeTeam");
    const awayTeam = searchParams.get("awayTeam");

    let teamRatings = null;

    if (homeTeam && awayTeam && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("team_ratings")
        .select("*")
        .in("team_name", [homeTeam, awayTeam]);

      if (!error && Array.isArray(data)) {
        teamRatings = data;
      }
    }

    const model = buildQuickModel({});

    return NextResponse.json({
      ok: true,
      model,
      teamRatings,
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
