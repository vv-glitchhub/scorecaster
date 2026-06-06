import { buildPortfolioAllocation } from "../../../lib/portfolio-allocation-engine";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const bankroll = Number(url.searchParams.get("bankroll") || 1000);
    const maxPortfolioRisk = Number(url.searchParams.get("maxPortfolioRisk") || 0.12);
    const maxSingleStake = Number(url.searchParams.get("maxSingleStake") || 0.04);

    const response = await fetch(`${url.origin}/api/top-picks`, {
      cache: "no-store"
    });

    const data = await response.json();
    const picks = Array.isArray(data?.data) ? data.data : [];

    const portfolio = buildPortfolioAllocation({
      picks,
      bankroll,
      maxPortfolioRisk,
      maxSingleStake
    });

    return Response.json({
      ok: true,
      source: "agent-v7-portfolio-allocation",
      agentVersion: "V7",
      bankroll,
      topPicksSource: data?.source || "unknown",
      portfolio
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "agent-v7-portfolio-allocation",
        error: error.message
      },
      { status: 500 }
    );
  }
}
