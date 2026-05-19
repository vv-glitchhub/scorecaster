"use client";

const STORAGE_KEY = "scorecaster_bet_history_v1";

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function getBetHistory() {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEY), []);
}

export function saveBetHistory(bets) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}

export function addBetToHistory(pick) {
  const bets = getBetHistory();

  const bet = {
    id: `${pick.id}-${Date.now()}`,
    createdAt: Date.now(),
    status: "open",
    result: "pending",

    label: pick.label,
    market: pick.market,
    bookmaker: pick.bookmaker || "Unknown",

    odds: Number(pick.odds || 0),
    stake: Number(pick.userStake || pick.stake || 0),

    edge: Number(pick.edge || 0),
    ev: Number(pick.ev || 0),
    addedOdds: Number(pick.addedOdds || pick.odds || 0),

    match: pick.match || null,
  };

  const updated = [bet, ...bets];
  saveBetHistory(updated);

  return updated;
}

export function updateBetResult(id, result) {
  const bets = getBetHistory();

  const updated = bets.map((bet) =>
    bet.id === id
      ? {
          ...bet,
          result,
          status: result === "pending" ? "open" : "closed",
          settledAt: result === "pending" ? null : Date.now(),
        }
      : bet
  );

  saveBetHistory(updated);
  return updated;
}

export function deleteBetFromHistory(id) {
  const updated = getBetHistory().filter((bet) => bet.id !== id);
  saveBetHistory(updated);
  return updated;
}

export function clearBetHistory() {
  saveBetHistory([]);
  return [];
}

export function getBetProfit(bet) {
  const stake = Number(bet.stake || 0);
  const odds = Number(bet.odds || 0);

  if (bet.result === "won") return stake * odds - stake;
  if (bet.result === "lost") return -stake;
  if (bet.result === "push" || bet.result === "void") return 0;

  return 0;
}

export function getBetHistoryStats(bets = []) {
  const settled = bets.filter((b) =>
    ["won", "lost", "push", "void"].includes(b.result)
  );

  const totalStake = settled.reduce((sum, b) => sum + Number(b.stake || 0), 0);
  const profit = settled.reduce((sum, b) => sum + getBetProfit(b), 0);

  const won = settled.filter((b) => b.result === "won").length;
  const lost = settled.filter((b) => b.result === "lost").length;

  return {
    totalBets: bets.length,
    openBets: bets.filter((b) => b.status === "open").length,
    settledBets: settled.length,
    won,
    lost,
    totalStake,
    profit,
    roi: totalStake > 0 ? profit / totalStake : 0,
    hitRate: won + lost > 0 ? won / (won + lost) : 0,
    averageOdds:
      settled.length > 0
        ? settled.reduce((sum, b) => sum + Number(b.odds || 0), 0) / settled.length
        : 0,
  };
}
