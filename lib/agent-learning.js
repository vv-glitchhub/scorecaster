import { calculateProfitLoss } from "./tracking-engine";

export function calculateAgentPerformance(bets = []) {
  const settled = bets.filter((bet) =>
    ["win", "loss", "push"].includes(bet.result)
  );

  const bySport = {};
  const byMarket = {};

  settled.forEach((bet) => {
    const sport = bet.sportKey || bet.league || "unknown";
    const market = bet.marketKey || "unknown";

    const profit = calculateProfitLoss({
      stake: bet.stake,
      odds: bet.odds,
      result: bet.result
    });

    if (!bySport[sport]) {
      bySport[sport] = {
        bets: 0,
        wins: 0,
        profit: 0
      };
    }

    if (!byMarket[market]) {
      byMarket[market] = {
        bets: 0,
        wins: 0,
        profit: 0
      };
    }

    bySport[sport].bets += 1;
    byMarket[market].bets += 1;

    if (bet.result === "win") {
      bySport[sport].wins += 1;
      byMarket[market].wins += 1;
    }

    bySport[sport].profit += profit;
    byMarket[market].profit += profit;
  });

  Object.values(bySport).forEach((item) => {
    item.winRate = item.bets > 0 ? item.wins / item.bets : 0;
  });

  Object.values(byMarket).forEach((item) => {
    item.winRate = item.bets > 0 ? item.wins / item.bets : 0;
  });

  return {
    sampleSize: settled.length,
    bySport,
    byMarket
  };
}
