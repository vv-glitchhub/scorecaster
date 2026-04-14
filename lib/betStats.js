export function getBetStats(bets) {
  const settled = bets.filter((b) => b.result !== "pending");

  const totalStaked = settled.reduce((sum, b) => sum + b.stake, 0);
  const totalProfit = settled.reduce((sum, b) => sum + b.profit, 0);

  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  const wins = settled.filter((b) => b.result === "win").length;
  const losses = settled.filter((b) => b.result === "lose").length;

  return {
    totalStaked,
    totalProfit,
    roi,
    wins,
    losses,
  };
}
