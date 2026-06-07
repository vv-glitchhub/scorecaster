import { calculateCLVV2, summarizeCLVHistory } from "../../../lib/clv-engine";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const bankroll = Number(url.searchParams.get("bankroll") || 1000);

    const topPicksResponse = await fetch(`${url.origin}/api/top-picks`, {
      cache: "no-store"
    });

    const topPicksData = await topPicksResponse.json();
    const picks = Array.isArray(topPicksData?.data) ? topPicksData.data : [];

    const clvItems = picks.slice(0, 20).map((pick) => {
      const currentOdds = Number(pick.odds || 0);
      const simulatedClosingOdds = estimateClosingOdds(pick);

      return {
        selection: pick.selection,
        homeTeam: pick.homeTeam,
        awayTeam: pick.awayTeam,
        league: pick.league || pick.leagueTitle,
        bookmaker: pick.bookmaker,
        decision: pick.decision,
        edge: Number(pick.edge || 0),
        qualityGrade: pick.qualityGrade || "N/A",
        qualityScore: Number(pick.qualityScore || 0),
        sourceTrust: Number(pick.sourceTrust || 0),
        clv: calculateCLVV2({
          betOdds: currentOdds,
          currentOdds,
          closingOdds: simulatedClosingOdds,
          stake: estimateStake({ pick, bankroll }),
          market: pick.marketKey || "h2h",
          bookmaker: pick.bookmaker
        })
      };
    });

    const history = summarizeCLVHistory(
      clvItems.map((item) => ({
        betOdds: item.clv.betOdds,
        currentOdds: item.clv.currentOdds,
        closingOdds: item.clv.closingOdds,
        stake: item.clv.stake,
        market: item.clv.market,
        bookmaker: item.clv.bookmaker
      }))
    );

    return Response.json({
      ok: true,
      source: "clv-tracker-v1",
      generatedAt: new Date().toISOString(),
      bankroll,
      topPicksSource: topPicksData?.source || "unknown",
      summary: {
        count: clvItems.length,
        averageCLVPercent: history.averageCLVPercent,
        positiveRate: history.positiveRate,
        grade: history.grade,
        note: history.note
      },
      data: clvItems
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "clv-tracker-v1",
        error: error.message
      },
      { status: 500 }
    );
  }
}

function estimateClosingOdds(pick) {
  const odds = Number(pick.odds || 0);
  if (!odds) return 0;

  const edge = Number(pick.edge || 0);
  const quality = Number(pick.qualityScore || 0);
  const trust = Number(pick.sourceTrust || 0.45);

  const improvement = Math.min(0.08, Math.max(0, edge * 0.35 + quality * 0.015 + trust * 0.01));

  return Math.max(1.01, odds * (1 - improvement));
}

function estimateStake({ pick, bankroll }) {
  const bank = Number(bankroll || 1000);
  const quality = Number(pick.qualityScore || 0);
  const edge = Number(pick.edge || 0);

  return Math.round(bank * Math.min(0.035, 0.006 + quality * 0.012 + edge * 0.18) * 100) / 100;
}
