export async function GET(request) {
  try {
    const url = new URL(request.url);
    const bankroll = Number(url.searchParams.get("bankroll") || 1000);

    const portfolioResponse = await fetch(
      `${url.origin}/api/portfolio?bankroll=${bankroll}`,
      { cache: "no-store" }
    );

    const portfolioData = await portfolioResponse.json();
    const portfolio = portfolioData?.portfolio || {};
    const allocations = Array.isArray(portfolio.allocations)
      ? portfolio.allocations
      : [];

    const bestBets = allocations.filter((item) => item.decision === "BET");
    const watchlist = allocations.filter((item) => item.decision === "WATCH");

    return Response.json({
      ok: true,
      source: "agent-v7-daily-picks",
      agentVersion: "V7",
      generatedAt: new Date().toISOString(),
      bankroll,
      summary: {
        totalPicks: allocations.length,
        bestBets: bestBets.length,
        watchlist: watchlist.length,
        allocated: portfolio.allocated || 0,
        remainingRiskBudget: portfolio.remainingRiskBudget || 0,
        riskLevel: portfolio.riskLevel || "None"
      },
      bestBets,
      watchlist,
      portfolio
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "agent-v7-daily-picks",
        error: error.message
      },
      { status: 500 }
    );
  }
}
