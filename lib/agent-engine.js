export function createAgentPick({
  match,
  selection,
  odds,
  edge,
  confidence,
  reasoning
}) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    match,
    selection,
    odds,
    edge,
    confidence,
    reasoning,
    result: "pending"
  };
}

export function settleAgentPick(pick, result) {
  return {
    ...pick,
    result
  };
}

export function calculateAgentProfit(picks = [], unitSize = 10) {
  return picks.reduce((sum, pick) => {
    if (pick.result === "win") {
      return sum + unitSize * (pick.odds - 1);
    }

    if (pick.result === "loss") {
      return sum - unitSize;
    }

    return sum;
  }, 0);
}

export function calculateAgentStats(picks = []) {
  const settled = picks.filter(
    (pick) =>
      pick.result === "win" ||
      pick.result === "loss"
  );

  const wins = settled.filter(
    (pick) => pick.result === "win"
  );

  const profit = calculateAgentProfit(picks);

  return {
    totalPicks: picks.length,
    settled: settled.length,
    wins: wins.length,
    losses: settled.length - wins.length,
    winRate:
      settled.length > 0
        ? wins.length / settled.length
        : 0,
    profit
  };
}

export function summarizeAgent(picks = []) {
  const stats = calculateAgentStats(picks);

  if (stats.winRate >= 0.55) {
    return "Agent performing above target.";
  }

  if (stats.winRate >= 0.5) {
    return "Agent performing near target.";
  }

  return "Agent underperforming. Review model assumptions.";
}
