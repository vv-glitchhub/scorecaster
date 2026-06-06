import { analyzeLiveBettingOpportunities } from "../../../lib/live-betting-engine";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const bankroll = Number(url.searchParams.get("bankroll") || 1000);
    const maxLiveExposure = Number(url.searchParams.get("maxLiveExposure") || 0.06);
    const minLiveScore = Number(url.searchParams.get("minLiveScore") || 0.08);

    const topPicksResponse = await fetch(`${url.origin}/api/top-picks`, {
      cache: "no-store"
    });

    const topPicksData = await topPicksResponse.json();
    const picks = Array.isArray(topPicksData?.data) ? topPicksData.data : [];

    const live = analyzeLiveBettingOpportunities({
      picks,
      bankroll,
      maxLiveExposure,
      minLiveScore
    });

    return Response.json({
      ok: true,
      source: "agent-v7-live-betting",
      agentVersion: "V7",
      generatedAt: new Date().toISOString(),
      topPicksSource: topPicksData?.source || "unknown",
      live
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "agent-v7-live-betting",
        error: error.message
      },
      { status: 500 }
    );
  }
}
