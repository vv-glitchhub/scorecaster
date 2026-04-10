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
    const limit = Number(searchParams.get("limit") || 5);

    const oddsData = await getOddsData({ sport });

    const picks = (oddsData.matches || [])
      .flatMap((match) => {
        const model = getModelProbabilitiesForMatch(match);
        return buildValueBetRows(match, model).map((row) => ({
          matchId: match.id,
          sport: match.sport_title,
          commence_time: match.commence_time,
          home_team: match.home_team,
          away_team: match.away_team,
          selection: row.side,
          team: row.team,
          odds: row.odds,
          fairOdds: row.fairOdds,
          edgePct: row.edgePct,
          expectedValue: row.expectedValue,
          confidence: model.confidence,
          bookmaker: row.bookmaker,
        }));
      })
      .filter((pick) => pick.expectedValue > 0)
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, limit);

    return NextResponse.json({
      source: oddsData.source,
      cached: oddsData.cached,
      picks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to build top picks",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
