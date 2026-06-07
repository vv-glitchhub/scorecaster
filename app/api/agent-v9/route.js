import { applyAgentScoreV9 } from "../../../lib/agent-score-engine-v9";
import { buildAgentLearningV4 } from "../../../lib/agent-learning-v4";
import { loadLearningRecords } from "../../../lib/learning-storage";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 20);

    const origin = url.origin;
    const agentResponse = await fetch(`${origin}/api/agent-v8?limit=${limit}`, {
      cache: "no-store"
    });

    const agentData = await agentResponse.json();
    const basePicks = Array.isArray(agentData?.data) ? agentData.data : [];

    const learningRecords = await loadLearningRecords({ limit: 500 });
    const records = Array.isArray(learningRecords?.records) ? learningRecords.records : [];
    const learning = buildAgentLearningV4({ records });

    const data = applyAgentScoreV9({
      picks: basePicks,
      learning
    });

    return Response.json({
      ok: true,
      source: "agent-v9-api",
      agentVersion: "V9",
      generatedAt: new Date().toISOString(),
      count: data.length,
      learningMode: records.length > 0 ? "adaptive" : "cold_start",
      learningSummary: learning.summary,
      learningWeights: learning.weights,
      recommendations: learning.recommendations,
      summary: {
        total: data.length,
        bets: data.filter((pick) => pick.decision === "BET").length,
        watchlist: data.filter((pick) => pick.decision === "WATCH").length,
        wait: data.filter((pick) => pick.decision === "WAIT").length,
        pass: data.filter((pick) => pick.decision === "PASS").length
      },
      data
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "agent-v9-api",
        error: error.message
      },
      { status: 500 }
    );
  }
}
