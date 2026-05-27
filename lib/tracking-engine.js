export function calculateProfitLoss({ stake, odds, result }) {
  if (result === "win") return stake * odds - stake;
  if (result === "loss") return -stake;
  if (result === "push") return 0;
  return 0;
}

export function calculateROI(totalProfit, totalStaked) {
  if (!totalStaked || totalStaked <= 0) return 0;
  return totalProfit / totalStaked;
}

export function calculateCLV({ takenOdds, closingOdds }) {
  if (!takenOdds || !closingOdds) return 0;
  return (takenOdds - closingOdds) / closingOdds;
}

export function summarizeBets(bets) {
  const settled = bets.filter((bet) => bet.result !== "pending");

  const totalStaked = settled.reduce((sum, bet) => sum + bet.stake, 0);

  const totalProfit = settled.reduce((sum, bet) => {
    return sum + calculateProfitLoss(bet);
  }, 0);

  const wins = settled.filter((bet) => bet.result === "win").length;
  const losses = settled.filter((bet) => bet.result === "loss").length;
  const pushes = settled.filter((bet) => bet.result === "push").length;

  return {
    totalBets: bets.length,
    settledBets: settled.length,
    pendingBets: bets.length - settled.length,
    totalStaked,
    totalProfit,
    roi: calculateROI(totalProfit, totalStaked),
    wins,
    losses,
    pushes,
    winRate: settled.length ? wins / settled.length : 0
  };
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatMoney(value) {
  return `${value.toFixed(2)}€`;
}
