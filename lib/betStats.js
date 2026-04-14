export function getBetStats(bets) {
  const settled = bets.filter((bet) => bet.result !== "pending");
  const totalStaked = bets.reduce((sum, bet) => sum + Number(bet.stake || 0), 0);
  const totalProfit = settled.reduce((sum, bet) => sum + Number(bet.profit || 0), 0);
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  const wins = settled.filter((bet) => bet.result === "win").length;
  const losses = settled.filter((bet) => bet.result === "lose").length;
  const voids = settled.filter((bet) => bet.result === "void").length;
  const pending = bets.filter((bet) => bet.result === "pending").length;

  return {
    totalStaked,
    totalProfit,
    roi,
    wins,
    losses,
    voids,
    pending,
  };
}
