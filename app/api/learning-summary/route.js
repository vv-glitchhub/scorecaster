import { loadLearningRecords, saveLearningRecord } from "../../../lib/learning-storage";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 250);

    const learning = await loadLearningRecords({ limit });

    return Response.json({
      ok: learning.ok,
      source: "learning-summary-v1",
      mode: learning.mode,
      table: learning.table,
      generatedAt: new Date().toISOString(),
      summary: learning.summary,
      adaptiveWeights: learning.adaptiveWeights,
      records: learning.records?.slice(0, 25) || [],
      warning: learning.warning || null,
      error: learning.error || null
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "learning-summary-v1",
        error: error.message
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const saved = await saveLearningRecord({
      pick: body.pick || body,
      result: body.result || null,
      clv: body.clv || null
    });

    return Response.json({
      ok: saved.ok,
      source: "learning-summary-v1",
      mode: saved.mode,
      table: saved.table,
      record: saved.record,
      warning: saved.warning || null,
      error: saved.error || null
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "learning-summary-v1",
        error: error.message
      },
      { status: 500 }
    );
  }
}
