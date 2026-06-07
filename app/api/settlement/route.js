import { settlePick } from "../../../lib/settlement-engine";
import { saveLearningRecord } from "../../../lib/learning-storage";

export async function POST(request) {
  try {
    const body = await request.json();
    const pick = body.pick || {};
    const finalScore = body.finalScore || {};

    const settlement = settlePick({ pick, finalScore });

    const saved = settlement.status === "settled"
      ? await saveLearningRecord({
          pick,
          result: settlement.result,
          clv: body.clv || null
        })
      : null;

    return Response.json({
      ok: true,
      source: "settlement-api-v1",
      settlement,
      learning: saved
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "settlement-api-v1",
        error: error.message
      },
      { status: 500 }
    );
  }
}
