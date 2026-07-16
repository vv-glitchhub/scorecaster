import type { PaperBet } from "../types";

export type LeagueAnalytics = {
  league: string;
  settled: number;
  wins: number;
  losses: number;
  stake: number;
  profit: number;
  roi: number;
  winRate: number;
};

export type PaperAnalytics = {
  totalBets: number;
  openBets: number;
  settledBets: number;
  wins: number;
  losses: number;
  voids: number;
  totalStake: number;
  totalProfit: number;
  roi: number;
  winRate: number;
  averageOdds: number;
  averageClv: number;
  positiveClvRate: number;
  openExposure: number;
  maxDrawdown: number;
  currentStreak: string;
  leagues: LeagueAnalytics[];
};

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function calculateDrawdown(bets: PaperBet[]) {
  const chronological = bets
    .filter((bet) => bet.status !== "open")
    .slice()
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  let balance = 0;
  let peak = 0;
  let maximum = 0;

  for (const bet of chronological) {
    balance += finite(bet.profit);
    peak = Math.max(peak, balance);
    maximum = Math.max(maximum, peak - balance);
  }

  return maximum;
}

function calculateStreak(bets: PaperBet[]) {
  const decisions = bets
    .filter((bet) => bet.status === "won" || bet.status === "lost")
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  const first = decisions.at(0);
  if (!first) return "–";

  const status = first.status;
  const length = decisions.findIndex((bet) => bet.status !== status);
  const count = length === -1 ? decisions.length : length;
  return `${status === "won" ? "W" : "L"}${count}`;
}

export function calculatePaperAnalytics(bets: PaperBet[] = []): PaperAnalytics {
  const open = bets.filter((bet) => bet.status === "open");
  const settled = bets.filter((bet) => bet.status !== "open");
  const decisions = settled.filter((bet) => bet.status === "won" || bet.status === "lost");
  const wins = decisions.filter((bet) => bet.status === "won").length;
  const losses = decisions.filter((bet) => bet.status === "lost").length;
  const voids = settled.filter((bet) => bet.status === "void" || bet.status === "push").length;
  const totalStake = settled.reduce((sum, bet) => sum + finite(bet.stake), 0);
  const totalProfit = settled.reduce((sum, bet) => sum + finite(bet.profit), 0);
  const clvValues = settled.map((bet) => Number(bet.clv)).filter(Number.isFinite);
  const positiveClv = clvValues.filter((value) => value > 0).length;
  const oddsValues = decisions.map((bet) => finite(bet.odds)).filter((value) => value > 1);

  const leagueMap = new Map<string, PaperBet[]>();
  for (const bet of settled) {
    const league = String(bet.league || bet.sport || "Muu");
    const current = leagueMap.get(league) || [];
    current.push(bet);
    leagueMap.set(league, current);
  }

  const leagues = [...leagueMap.entries()]
    .map(([league, leagueBets]) => {
      const leagueDecisions = leagueBets.filter((bet) => bet.status === "won" || bet.status === "lost");
      const leagueWins = leagueDecisions.filter((bet) => bet.status === "won").length;
      const leagueLosses = leagueDecisions.filter((bet) => bet.status === "lost").length;
      const stake = leagueBets.reduce((sum, bet) => sum + finite(bet.stake), 0);
      const profit = leagueBets.reduce((sum, bet) => sum + finite(bet.profit), 0);

      return {
        league,
        settled: leagueBets.length,
        wins: leagueWins,
        losses: leagueLosses,
        stake,
        profit,
        roi: stake > 0 ? profit / stake : 0,
        winRate: leagueDecisions.length ? leagueWins / leagueDecisions.length : 0
      };
    })
    .sort((a, b) => b.settled - a.settled || b.roi - a.roi)
    .slice(0, 8);

  return {
    totalBets: bets.length,
    openBets: open.length,
    settledBets: settled.length,
    wins,
    losses,
    voids,
    totalStake,
    totalProfit,
    roi: totalStake > 0 ? totalProfit / totalStake : 0,
    winRate: decisions.length ? wins / decisions.length : 0,
    averageOdds: oddsValues.length
      ? oddsValues.reduce((sum, value) => sum + value, 0) / oddsValues.length
      : 0,
    averageClv: clvValues.length
      ? clvValues.reduce((sum, value) => sum + value, 0) / clvValues.length
      : 0,
    positiveClvRate: clvValues.length ? positiveClv / clvValues.length : 0,
    openExposure: open.reduce((sum, bet) => sum + finite(bet.stake), 0),
    maxDrawdown: calculateDrawdown(bets),
    currentStreak: calculateStreak(bets),
    leagues
  };
}
