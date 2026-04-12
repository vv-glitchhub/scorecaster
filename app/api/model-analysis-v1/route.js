import { NextResponse } from "next/server";
import { getOddsData } from "@/lib/odds-service";
import {
  buildValueBetRows,
  getModelProbabilitiesForMatch,
} from "@/lib/model-engine-v1";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const sport = searchParams.get("sport") || "icehockey_liiga";
    const matchId = searchParams.get("matchId");
    const market = searchParams.get("market") || "h2h";

    const oddsData = await getOddsData({ sport, market });
    const matches = oddsData?.matches || [];

    const match = matchId
      ? matches.find((item) => item.id === matchId)
      : matches[0];

    if (!match) {
      return NextResponse.json(
        { error: "No match found for analysis" },
        { status: 404 }
      );
    }

    const model = getModelProbabilitiesForMatch(match, market);
    const valueBets = buildValueBetRows(match, model, market);

    return NextResponse.json({
      source: oddsData.source,
      cached: oddsData.cached,
      market,
      match,
      model,
      valueBets,
      bestValueBet: valueBets[0] || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Model analysis failed",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
