import { findResultForBet, getWinnerFromResult } from "@/lib/result-engine";

export function settleBet(bet, results = []) {
  if (!bet || bet.status === "closed") return bet;

  const result = findResultForBet(bet, results);
  if (!result) return bet;

  const winner = getWinnerFromResult(result);
  if (!winner) return bet;

  let settledResult = "lost";

  if (bet.key === "home" && winner === "home") settledResult = "won";
  if (bet.key === "away" && winner === "away") settledResult = "won";
  if (bet.key === "draw" && winner === "draw") settledResult = "won";

  return {
    ...bet,
    result: settledResult,
    status: "closed",
    settledAt: Date.now(),
    settlementSource: "auto",
    finalScore: {
      home: result.home_score,
      away: result.away_score,
    },
  };
}

export function settleBets(bets = [], results = []) {
  return bets.map((bet) => settleBet(bet, results));
}
