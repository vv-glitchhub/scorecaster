export async function GET(request) {
  try {
    const url = new URL(request.url);
    const bankroll = Number(url.searchParams.get("bankroll") || 1000);
    const limit = Number(url.searchParams.get("limit") || 10);

    const portfolioResponse = await fetch(
      `${url.origin}/api/portfolio?bankroll=${bankroll}`,
      { cache: "no-store" }
    );

    const portfolioData = await portfolioResponse.json();
    const portfolio = portfolioData?.portfolio || {};
    const allocations = Array.isArray(portfolio.allocations) ? portfolio.allocations : [];

    const ranked = allocations
      .map((item) => ({
        ...item,
        dailyScore: calculateDailyScore(item),
        dailyGrade: gradeDailyPick(calculateDailyScore(item)),
        reason: buildDailyReason(item)
      }))
      .sort((a, b) => Number(b.dailyScore || 0) - Number(a.dailyScore || 0));

    const top3 = ranked.slice(0, 3);
    const top5 = ranked.slice(0, 5);
    const top10 = ranked.slice(0, limit);
    const bestBets = ranked.filter((item) => item.decision === "BET");
    const watchlist = ranked.filter((item) => item.decision === "WATCH");

    return Response.json({
      ok: true,
      source: "daily-picks-v2",
      agentVersion: "V9",
      generatedAt: new Date().toISOString(),
      bankroll,
      summary: {
        totalPicks: ranked.length,
        bestBets: bestBets.length,
        watchlist: watchlist.length,
        top3: top3.length,
        top5: top5.length,
        top10: top10.length,
        allocated: portfolio.allocated || 0,
        remainingRiskBudget: portfolio.remainingRiskBudget || 0,
        riskLevel: portfolio.riskLevel || "None"
      },
      top3,
      top5,
      top10,
      bestBets,
      watchlist,
      portfolio
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "daily-picks-v2",
        error: error.message
      },
      { status: 500 }
    );
  }
}

function calculateDailyScore(item) {
  const score = Number(item.finalScore100 || 0);
  const edge = Number(item.edge || 0) * 100;
  const stakePercent = Number(item.stakePercent || 0) * 100;
  const trust = Number(item.sourceTrust || 0) * 10;
  const decisionBoost = item.decision === "BET" ? 8 : item.decision === "WATCH" ? 3 : 0;
  const riskPenalty = item.exposure === "High" ? -5 : item.exposure === "Medium" ? -2 : 0;

  return clamp(score + edge + trust + decisionBoost - stakePercent * 0.3 + riskPenalty, 0, 100);
}

function gradeDailyPick(score) {
  if (score >= 90) return "A+";
  if (score >= 82) return "A";
  if (score >= 72) return "B";
  if (score >= 62) return "C";
  if (score >= 50) return "D";
  return "F";
}

function buildDailyReason(item) {
  const notes = [];
  if (item.decision === "BET") notes.push("Agent V9 classifies this as a primary paper pick.");
  if (item.decision === "WATCH") notes.push("Watchlist-level pick with controlled exposure.");
  if (Number(item.edge || 0) > 0.04) notes.push("Positive edge supports the ranking.");
  if (item.gradeV9 && item.gradeV9 !== "N/A") notes.push(`Agent grade: ${item.gradeV9}.`);
  if (item.exposure === "High") notes.push("Exposure is high, so stake should stay capped.");
  if (!notes.length) notes.push("Included by daily ranking model.");
  return notes;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
