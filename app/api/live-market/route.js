import { loadClosingLineHistory } from "../../../lib/closing-line-storage";
import { buildCLVTrackingV2 } from "../../../lib/clv-tracking-v2";
import { buildMarketMovementAnalysis } from "../../../lib/market-movement-engine-v1";
import { buildSharpIndexV2 } from "../../../lib/sharp-index-engine-v2";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 50);
    const sportKey = url.searchParams.get("sport") || null;

    const [closingLines, agentResponse] = await Promise.all([
      loadClosingLineHistory({ limit: 500, sportKey }),
      fetch(`${url.origin}/api/agent-v9?limit=${limit}`, { cache: "no-store" })
    ]);

    const agentData = await agentResponse.json();
    const picks = Array.isArray(agentData?.data) ? agentData.data : [];
    const records = Array.isArray(closingLines?.records) ? closingLines.records : [];

    const clv = buildCLVTrackingV2({ closingLines: records, picks });
    const movement = buildMarketMovementAnalysis({ closingLines: records, picks });
    const sharp = buildSharpIndexV2({ clv, movement, picks });

    return Response.json({
      ok: true,
      source: "live-market-center-v1",
      generatedAt: new Date().toISOString(),
      sportKey,
      refreshMode: "manual_or_safe_interval",
      summary: {
        picks: picks.length,
        closingLineRecords: records.length,
        clvAvailable: clv.summary.available,
        steamMoves: movement.summary.steamMoves,
        reverseMoves: movement.summary.reverseMoves,
        strongSharpSignals: sharp.summary.strongSignals,
        averageSharpIndex: sharp.summary.averageSharpIndex
      },
      feeds: {
        steamMoves: movement.steamMoves.slice(0, 20),
        reverseMoves: movement.reverseMoves.slice(0, 20),
        pressureMoves: movement.pressureMoves.slice(0, 20),
        strongestSharpSignals: sharp.strongestSignals.slice(0, 20),
        positiveCLV: clv.biggestPositiveCLV.slice(0, 20),
        negativeCLV: clv.biggestNegativeCLV.slice(0, 20)
      },
      clv,
      movement,
      sharp
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "live-market-center-v1",
        error: error.message
      },
      { status: 500 }
    );
  }
}
