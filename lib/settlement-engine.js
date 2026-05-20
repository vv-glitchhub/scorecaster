import { findResultForBet, getWinnerFromResult } from "@/lib/result-engine";

function getTotalScore(result) {
  const home = Number(result?.home_score);
  const away = Number(result?.away_score);

  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return home + away;
}

function settleTotals(bet, result) {
  const total = getTotalScore(result);
  const pointText = String(bet.label || "").match(/(\d+(\.\d+)?)/);
  const point = pointText ? Number(pointText[1]) : null;

  if (!Number.isFinite(total) || !Number.isFinite(point)) return "pending";

  if (bet.key === "over") {
    if (total > point) return "won";
    if (total < point) return "lost";
    return "push";
  }

  if (bet.key === "under") {
    if (total < point) return "won";
    if (total > point) return "lost";
    return "push";
  }

  return "pending";
}

function settleH2H(bet, result) {
  const winner = getWinnerFromResult(result);
  if (!winner) return "pending";

  if (bet.key === "home" && winner === "home") return "won";
  if (bet.key === "away" && winner === "away") return "won";
  if (bet.key === "draw" && winner === "draw") return "won";

  return "lost";
}

export function settleBet(bet, results = []) {
  if (!bet || bet.status === "closed") return bet;

  const result = findResultForBet(bet, results);
  if (!result) return bet;

  let settledResult = "pending";

  if (bet.key === "home" || bet.key === "away" || bet.key === "draw") {
    settledResult = settleH2H(bet, result);
  }

  if (bet.key === "over" || bet.key === "under") {
    settledResult = settleTotals(bet, result);
  }

  if (settledResult === "pending") return bet;

  return {
    ...bet,
    result: settledResult,
    status: settledResult === "pending" ? "open" : "closed",
    settledAt: Date.now(),
    settlementSource: "auto-thesportsdb",
    finalScore: {
      home: result.home_score,
      away: result.away_score,
    },
  };
}

export function settleBets(bets = [], results = []) {
  return bets.map((bet) => settleBet(bet, results));
}
