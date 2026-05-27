import { analyzeBet } from "../../../lib/analysis-engine";

export async function POST(request) {
  try {
    const body = await request.json();

    const analysis = analyzeBet({
      selection: body.selection,
      decimalOdds: Number(body.decimalOdds),
      modelProbability: Number(body.modelProbability),
      volatility: body.volatility || "medium",
      bankroll: Number(body.bankroll || 1000)
    });

    return Response.json({
      ok: true,
      analysis
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
