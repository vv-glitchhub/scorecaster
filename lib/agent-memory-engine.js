import { calculateProfitLoss } from "./tracking-engine";

export function buildAgentMemory(trackedBets = []) {
  const settled = trackedBets.filter((bet) =>
    ["win", "loss", "push", "WIN", "LOSS", "PUSH"].includes(bet.result)
  );

  const memory = {
    totalBets: settled.length,
    wins: 0,
    losses: 0,
    pushes: 0,
    profit: 0,
    sports: {},
    markets: {},
    bookmakers: {},
    strengths: [],
    weaknesses: []
  };

  for (const bet of settled) {
    const result = String(bet.result || "").toLowerCase();

    const profit = calculateProfitLoss({
      stake: bet.stake,
      odds: bet.odds,
      result
    });

    if (result === "win") memory.wins += 1;
    if (result === "loss") memory.losses += 1;
    if (result === "push") memory.pushes += 1;

    memory.profit += profit;

    const sport = bet.sportKey || bet.league || "unknown";
    const market = bet.marketKey || "unknown";
    const bookmaker = bet.bookmaker || "unknown";

    addMemoryRow(memory.sports, sport, result, profit);
    addMemoryRow(memory.markets, market, result, profit);
    addMemoryRow(memory.bookmakers, bookmaker, result, profit);
  }

  memory.strengths = Object.entries(memory.sports)
    .sort((a, b) => b[1].profit - a[1].profit)
    .slice(0, 5);

  memory.weaknesses = Object.entries(memory.sports)
    .sort((a, b) => a[1].profit - b[1].profit)
    .slice(0, 5);

  return memory;
}

function addMemoryRow(target, key, result, profit) {
  if (!target[key]) {
    target[key] = {
      bets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      profit: 0,
      winRate: 0
    };
  }

  target[key].bets += 1;
  target[key].profit += profit;

  if (result === "win") target[key].wins += 1;
  if (result === "loss") target[key].losses += 1;
  if (result === "push") target[key].pushes += 1;

  target[key].winRate =
    target[key].bets > 0 ? target[key].wins / target[key].bets : 0;
}
