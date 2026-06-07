import { applyAgentV8AdaptiveWeights } from "../../../lib/agent-v8-adaptive-engine";
import { loadLearningRecords } from "../../../lib/learning-storage";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const topPicksResponse = await fetch(`${url.origin}/api/top-picks`, {
      cache: "no-store"
    });

    const topPicks = await topPicksResponse.json();
    const learning = await loadLearningRecords({ limit: 250 });
    const picks = Array.isArray(topPicks?.data) ? topPicks.data : [];

    const adjusted = applyAgentV8AdaptiveWeights({
      picks,
      adaptiveWeights: learning?.adaptiveWeights
    }).slice(0, 20);

    return Response.json({
      ok: true,
      source: "agent-v8-api",
      agentVersion: "V8",
      generatedAt: new Date().toISOString(),
      learningMode: learning?.mode || "unknown",
      learningSummary: learning?.summary || null,
      adaptiveWeights: learning?.adaptiveWeights || null,
      summary: {
        total: adjusted.length,
        bestBets: adjusted.filter((item) => item.decision === "BET").length,
        watchlist: adjusted.filter((item) => item.decision === "WATCH").length
      },
      data: adjusted
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "agent-v8-api",
        error: error.message
      },
      { status: 500 }
    );
  }
}
