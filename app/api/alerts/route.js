import { buildAlertsV1 } from "../../../lib/alert-engine-v1";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 50);

    const [liveResponse, agentResponse] = await Promise.all([
      fetch(`${url.origin}/api/live-market?limit=${limit}`, { cache: "no-store" }),
      fetch(`${url.origin}/api/agent-v9?limit=${limit}`, { cache: "no-store" })
    ]);

    const liveMarket = await liveResponse.json();
    const agentData = await agentResponse.json();
    const picks = Array.isArray(agentData?.data) ? agentData.data : [];
    const alerts = buildAlertsV1({ liveMarket, picks });

    return Response.json({
      ok: true,
      source: "alert-center-api-v1",
      generatedAt: new Date().toISOString(),
      alertEngine: alerts.source,
      summary: alerts.summary,
      alerts: alerts.alerts,
      critical: alerts.critical,
      high: alerts.high,
      medium: alerts.medium,
      info: alerts.info,
      inputs: {
        picks: picks.length,
        liveMarketSource: liveMarket?.source || "unknown"
      }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "alert-center-api-v1",
        error: error.message
      },
      { status: 500 }
    );
  }
}
