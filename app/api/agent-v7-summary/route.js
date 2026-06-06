export async function GET(request) {
  try {
    const url = new URL(request.url);
    const bankroll = Number(url.searchParams.get("bankroll") || 1000);

    const [healthRes, dailyRes, portfolioRes, liveRes, historicalRes] = await Promise.all([
      fetch(`${url.origin}/api/system-health`, { cache: "no-store" }),
      fetch(`${url.origin}/api/daily-picks?bankroll=${bankroll}`, { cache: "no-store" }),
      fetch(`${url.origin}/api/portfolio?bankroll=${bankroll}`, { cache: "no-store" }),
      fetch(`${url.origin}/api/live-betting?bankroll=${bankroll}`, { cache: "no-store" }),
      fetch(`${url.origin}/api/historical-odds`, { cache: "no-store" })
    ]);

    const [health, daily, portfolio, live, historical] = await Promise.all([
      healthRes.json(),
      dailyRes.json(),
      portfolioRes.json(),
      liveRes.json(),
      historicalRes.json()
    ]);

    const bestBets = daily?.bestBets || [];
    const watchlist = daily?.watchlist || [];
    const liveOpportunities = live?.live?.opportunities || [];

    return Response.json({
      ok: true,
      source: "agent-v7-summary",
      agentVersion: "V7",
      generatedAt: new Date().toISOString(),
      bankroll,
      health: {
        ok: Boolean(health?.ok),
        passed: health?.summary?.passed || 0,
        total: health?.summary?.total || 0
      },
      summary: {
        bestBets: bestBets.length,
        watchlist: watchlist.length,
        liveOpportunities: liveOpportunities.length,
        allocated: portfolio?.portfolio?.allocated || daily?.portfolio?.allocated || 0,
        riskLevel: portfolio?.portfolio?.riskLevel || daily?.portfolio?.riskLevel || "None",
        historicalSnapshots: historical?.summary?.count || 0
      },
      bestBets: bestBets.slice(0, 5),
      watchlist: watchlist.slice(0, 5),
      liveOpportunities: liveOpportunities.slice(0, 5),
      historical: {
        summary: historical?.summary || null,
        movement: historical?.movement || null
      }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "agent-v7-summary",
        error: error.message
      },
      { status: 500 }
    );
  }
}
