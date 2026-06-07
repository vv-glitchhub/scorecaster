import { fetchFinalScores } from "../../../lib/score-fetcher";
import { runSettlementForPicks } from "../../../lib/settlement-runner";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const sportParam = url.searchParams.get("sports") || "icehockey_nhl,basketball_nba,soccer_epl";
    const sports = sportParam.split(",").map((item) => item.trim()).filter(Boolean);

    const agentResponse = await fetch(`${url.origin}/api/agent-v8`, { cache: "no-store" });
    const agentData = await agentResponse.json();
    const picks = Array.isArray(agentData?.data) ? agentData.data : [];

    const scoreData = await fetchFinalScores({
      origin: url.origin,
      sports
    });

    const settlement = await runSettlementForPicks({
      picks,
      scores: scoreData.scores || {}
    });

    return Response.json({
      ok: true,
      source: "scheduled-settlement-job-v1",
      generatedAt: new Date().toISOString(),
      sports,
      scoreFetch: {
        source: scoreData.source,
        count: scoreData.count,
        errors: scoreData.errors || []
      },
      agent: {
        source: agentData?.source,
        agentVersion: agentData?.agentVersion,
        picks: picks.length
      },
      settlement
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "scheduled-settlement-job-v1",
        error: error.message
      },
      { status: 500 }
    );
  }
}
