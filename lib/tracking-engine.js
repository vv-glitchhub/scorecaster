export function calculateProfitLoss({ stake, odds, result }) {
  const numericStake = Number(stake);
  const numericOdds = Number(odds);

  if (result === "win") {
    return numericStake * (numericOdds - 1);
  }

  if (result === "loss") {
    return -numericStake;
  }

  return 0;
}

export function calculateTrackingStats(bets = []) {
  const settled = bets.filter((bet) => bet.result !== "pending");

  const wins = settled.filter((bet) => bet.result === "win");
  const losses = settled.filter((bet) => bet.result === "loss");

  const totalStake = bets.reduce(
    (sum, bet) => sum + Number(bet.stake || 0),
    0
  );

  const totalProfit = settled.reduce(
    (sum, bet) =>
      sum +
      calculateProfitLoss({
        stake: bet.stake,
        odds: bet.odds,
        result: bet.result
      }),
    0
  );

  return {
    totalBets: bets.length,
    settledBets: settled.length,
    wins: wins.length,
    losses: losses.length,
    totalStake,
    totalProfit,
    roi: totalStake > 0 ? totalProfit / totalStake : 0,
    winRate:
      settled.length > 0 ? wins.length / settled.length : 0
  };
}
