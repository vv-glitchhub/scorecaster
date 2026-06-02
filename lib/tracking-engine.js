export function calculateProfitLoss({ stake, odds, result }) {
  const s = Number(stake || 0);
  const o = Number(odds || 0);

  if (result === "win") return s * (o - 1);
  if (result === "loss") return -s;
  if (result === "push") return 0;

  return 0;
}

export function calculateCLV({ odds, closingOdds }) {
  const open = Number(odds || 0);
  const close = Number(closingOdds || 0);

  if (!open || !close) return 0;

  return (open - close) / close;
}

export function calculateStreaks(bets = []) {
  const settled = bets
    .filter((bet) => ["win", "loss"].includes(bet.result))
    .slice()
    .reverse();

  let currentType = null;
  let currentCount = 0;
  let longestWin = 0;
  let longestLoss = 0;

  for (const bet of settled) {
    if (!currentType) {
      currentType = bet.result;
      currentCount = 1;
    } else if (bet.result === currentType) {
      currentCount += 1;
    } else {
      currentType = bet.result;
      currentCount = 1;
    }

    if (bet.result === "win") longestWin = Math.max(longestWin, currentCount);
    if (bet.result === "loss") longestLoss = Math.max(longestLoss, currentCount);
  }

  return {
    currentStreak: currentType ? `${currentCount} ${currentType}` : "-",
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss
  };
}

export function calculateTrackingStats(bets = []) {
  const settled = bets.filter((bet) =>
    ["win", "loss", "push"].includes(bet.result)
  );

  const wins = settled.filter((bet) => bet.result === "win");
  const losses = settled.filter((bet) => bet.result === "loss");
  const pushes = settled.filter((bet) => bet.result === "push");

  const totalStake = settled.reduce(
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

  const averageEdge =
    bets.length > 0
      ? bets.reduce((sum, bet) => sum + Number(bet.edge || 0), 0) / bets.length
      : 0;

  const averageEV =
    bets.length > 0
      ? bets.reduce((sum, bet) => sum + Number(bet.ev || 0), 0) / bets.length
      : 0;

  const averageOdds =
    bets.length > 0
      ? bets.reduce((sum, bet) => sum + Number(bet.odds || 0), 0) / bets.length
      : 0;

  const betsWithCLV = bets.filter((bet) => bet.closingOdds);

  const averageCLV =
    betsWithCLV.length > 0
      ? betsWithCLV.reduce(
          (sum, bet) =>
            sum +
            calculateCLV({
              odds: bet.odds,
              closingOdds: bet.closingOdds
            }),
          0
        ) / betsWithCLV.length
      : 0;

  const streaks = calculateStreaks(bets);

  return {
    totalBets: bets.length,
    openBets: bets.filter((bet) => bet.result === "pending").length,
    settledBets: settled.length,
    wins: wins.length,
    losses: losses.length,
    pushes: pushes.length,
    totalStake,
    totalProfit,
    roi: totalStake > 0 ? totalProfit / totalStake : 0,
    winRate: settled.length > 0 ? wins.length / settled.length : 0,
    averageEdge,
    averageEV,
    averageOdds,
    averageCLV,
    ...streaks
  };
}
