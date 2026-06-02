export function calculateAgentPerformance(bets = []) {
  const settled = bets.filter(
    (bet) =>
      bet.result === "win" ||
      bet.result === "loss" ||
      bet.result === "push"
  );

  const bySport = {};
  const byMarket = {};

  settled.forEach((bet) => {
    const sport = bet.sportKey || "unknown";
    const market = bet.marketKey || "unknown";

    if (!bySport[sport]) {
      bySport[sport] = {
        bets: 0,
        wins: 0,
        roi: 0
      };
    }

    if (!byMarket[market]) {
      byMarket[market] = {
        bets: 0,
        wins: 0,
        roi: 0
      };
    }

    bySport[sport].bets++;
    byMarket[market].bets++;

    if (bet.result === "win") {
      bySport[sport].wins++;
      byMarket[market].wins++;
    }

    bySport[sport].roi += Number(bet.profitLoss || 0);
    byMarket[market].roi += Number(bet.profitLoss || 0);
  });

  return {
    bySport,
    byMarket,
    sampleSize: settled.length
  };
}
