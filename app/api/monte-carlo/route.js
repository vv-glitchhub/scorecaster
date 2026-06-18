import { runMonteCarloSimulatorV2, runPortfolioMonteCarloV2 } from "../../../lib/monte-carlo-simulator-v2";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const bankroll = Number(url.searchParams.get("bankroll") || 1000);
    const simulations = Number(url.searchParams.get("simulations") || 10000);
    const horizon = Number(url.searchParams.get("horizon") || 100);
    const mode = url.searchParams.get("mode") || "portfolio";

    const agentResponse = await fetch(`${url.origin}/api/agent-v9?limit=20`, { cache: "no-store" });
    const agentData = await agentResponse.json();
    const picks = Array.isArray(agentData?.data) ? agentData.data : [];
    const qualified = picks.filter((pick) => ["BET", "WATCH"].includes(pick.decision)).slice(0, 10);

    if (mode === "single") {
      const pick = qualified[0] || picks[0] || {};
      const result = runMonteCarloSimulatorV2({
        pick,
        simulations,
        bankroll,
        horizon
      });

      return Response.json({
        ok: true,
        source: "monte-carlo-api-v1",
        mode: "single",
        generatedAt: new Date().toISOString(),
        pick,
        result
      });
    }

    const result = runPortfolioMonteCarloV2({
      picks: qualified,
      simulations,
      bankroll,
      horizon: 1
    });

    return Response.json({
      ok: true,
      source: "monte-carlo-api-v1",
      mode: "portfolio",
      generatedAt: new Date().toISOString(),
      picks: qualified,
      result
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "monte-carlo-api-v1",
        error: error.message
      },
      { status: 500 }
    );
  }
}
