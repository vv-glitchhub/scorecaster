import { findResultForBet, getWinnerFromResult } from "@/lib/result-engine";

function getTotalScore(result) {
  const home = Number(result?.home_score ?? result?.homeScore);
  const away = Number(result?.away_score ?? result?.awayScore);

  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return home + away;
}

function getHomeAway(result) {
  return {
    home: Number(result?.home_score ?? result?.homeScore),
    away: Number(result?.away_score ?? result?.awayScore)
  };
}

function settleTotals(bet, result) {
  const total = getTotalScore(result);
  const pointText = String(bet.label || bet.selection || "").match(/(\d+(\.\d+)?)/);
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

export function settlePick({ pick = {}, finalScore = {} }) {
  const selection = String(pick.selection || "").toLowerCase();
  const homeTeam = String(pick.homeTeam || "").toLowerCase();
  const awayTeam = String(pick.awayTeam || "").toLowerCase();
  const scores = getHomeAway(finalScore);

  if (!Number.isFinite(scores.home) || !Number.isFinite(scores.away)) {
    return { status: "pending", result: "pending", reason: "Final score is missing." };
  }

  if (scores.home === scores.away) {
    return {
      status: "settled",
      result: "push",
      winner: null,
      homeScore: scores.home,
      awayScore: scores.away,
      reason: "Game ended tied."
    };
  }

  const winnerKey = scores.home > scores.away ? "home" : "away";
  const winnerName = scores.home > scores.away ? pick.homeTeam : pick.awayTeam;
  const winner = winnerKey === "home" ? homeTeam : awayTeam;
  const result = selection === winner ? "win" : "loss";

  return {
    status: "settled",
    result,
    winner: winnerName,
    homeScore: scores.home,
    awayScore: scores.away,
    reason: result === "win" ? "Selection matched winner." : "Selection did not match winner."
  };
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
