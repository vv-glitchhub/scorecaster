import { analyzeBet, formatPercent, formatMoney } from "./analysis-engine";
import { calculateProfitLoss } from "./tracking-engine";

export const AGENT_STARTING_BANKROLL = 1000;

export function createAgentPick({
  id,
  match,
  league,
  market,
  selection,
  odds,
  modelProbability,
  volatility = "medium",
  bankroll = AGENT_STARTING_BANKROLL,
  reasoning = []
}) {
  const analysis = analyzeBet({
    selection,
    decimalOdds: odds,
    modelProbability,
    volatility,
    bankroll
  });

  return {
    id,
    match,
    league,
    market,
    selection,
    odds,
    modelProbability,
    marketProbability: analysis.marketProbability,
    edge: analysis.edge,
    ev: analysis.ev,
    confidence: analysis.confidence,
    suggestedStake: Math.min(analysis.suggestedStake, bankroll * 0.05),
    status: "pending",
    result: "pending",
    profitLoss: 0,
    reasoning,
    lesson: null
  };
}

export function settleAgentPick(pick, result) {
  const settledPick = {
    ...pick,
    status: "settled",
    result
  };

  const profitLoss = calculateProfitLoss({
    stake: settledPick.suggestedStake,
    odds: settledPick.odds,
    result
  });

  return {
    ...settledPick,
    profitLoss,
    lesson: generateAgentLesson({ ...settledPick, profitLoss })
  };
}

export function generateAgentLesson(pick) {
  if (pick.result === "win") {
    return {
      summary: "Prediction succeeded.",
      whatWentRight:
        "Model edge and market disagreement were aligned with the final result.",
      whatWentWrong:
        "Risk factors still need monitoring before increasing stake size.",
      futureAdjustment:
        "Keep similar confidence level, but continue tracking CLV and late market movement."
    };
  }

  if (pick.result === "loss") {
    return {
      summary: "Prediction failed.",
      whatWentRight:
        "The pick had positive expected value based on pre-match assumptions.",
      whatWentWrong:
        "The model may have underestimated volatility, lineup uncertainty or matchup risk.",
      futureAdjustment:
        "Reduce confidence when volatility is medium-high and important lineup data is missing."
    };
  }

  return {
    summary: "No strong learning signal.",
    whatWentRight: "Risk exposure was controlled.",
    whatWentWrong: "Result did not provide enough feedback.",
    futureAdjustment: "Keep monitoring similar market situations."
  };
}

export function summarizeAgent(picks, startingBankroll = AGENT_STARTING_BANKROLL) {
  const settled = picks.filter((pick) => pick.status === "settled");
  const pending = picks.filter((pick) => pick.status === "pending");

  const totalProfit = settled.reduce((sum, pick) => sum + pick.profitLoss, 0);
  const bankroll = startingBankroll + totalProfit;
  const wins = settled.filter((pick) => pick.result === "win").length;
  const losses = settled.filter((pick) => pick.result === "loss").length;
  const totalStaked = picks.reduce((sum, pick) => sum + pick.suggestedStake, 0);

  return {
    startingBankroll,
    bankroll,
    totalProfit,
    totalPicks: picks.length,
    settledPicks: settled.length,
    pendingPicks: pending.length,
    wins,
    losses,
    winRate: settled.length ? wins / settled.length : 0,
    roi: totalStaked ? totalProfit / totalStaked : 0
  };
}

export function formatAgentPick(pick) {
  return {
    ...pick,
    edgeText: formatPercent(pick.edge),
    evText: formatPercent(pick.ev),
    stakeText: formatMoney(pick.suggestedStake)
  };
}
