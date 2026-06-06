export function buildPortfolioAllocation({
  picks = [],
  bankroll = 1000,
  maxPortfolioRisk = 0.12,
  maxSingleStake = 0.04,
  minFinalScore = 0.06
}) {
  const bank = Number(bankroll || 1000);
  const filtered = picks
    .filter((pick) => ["BET", "WATCH"].includes(pick.decision))
    .filter((pick) => Number(pick.finalScore || 0) >= minFinalScore)
    .sort((a, b) => Number(b.finalScore || 0) - Number(a.finalScore || 0));

  const totalRiskBudget = bank * Number(maxPortfolioRisk || 0.12);
  const maxPerBet = bank * Number(maxSingleStake || 0.04);

  let usedBudget = 0;

  const allocations = filtered.map((pick, index) => {
    const confidenceWeight = calculateConfidenceWeight(pick);
    const rawStake = bank * confidenceWeight;
    const cappedStake = Math.min(rawStake, maxPerBet, Math.max(totalRiskBudget - usedBudget, 0));

    usedBudget += cappedStake;

    return {
      rank: index + 1,
      selection: pick.selection,
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      league: pick.league || pick.leagueTitle,
      bookmaker: pick.bookmaker,
      odds: pick.odds,
      decision: pick.decision,
      finalScore: Number(pick.finalScore || 0),
      edge: Number(pick.edge || 0),
      sourceTrust: Number(pick.sourceTrust || 0),
      sentimentScore: Number(pick.sentimentScore || 0),
      suggestedStake: roundMoney(cappedStake),
      stakePercent: bank > 0 ? cappedStake / bank : 0,
      reason: buildAllocationReason(pick, cappedStake)
    };
  }).filter((item) => item.suggestedStake > 0);

  return {
    bankroll: bank,
    maxPortfolioRisk,
    maxSingleStake,
    totalRiskBudget: roundMoney(totalRiskBudget),
    allocated: roundMoney(allocations.reduce((sum, item) => sum + item.suggestedStake, 0)),
    remainingRiskBudget: roundMoney(totalRiskBudget - allocations.reduce((sum, item) => sum + item.suggestedStake, 0)),
    count: allocations.length,
    riskLevel: classifyPortfolioRisk(allocations, bank),
    allocations
  };
}

function calculateConfidenceWeight(pick) {
  const score = Number(pick.finalScore || 0);
  const edge = Number(pick.edge || 0);
  const trust = Number(pick.sourceTrust || 0.4);
  const sentiment = Number(pick.sentimentScore || 0);

  const base = 0.01;
  const scoreBoost = clamp(score * 0.12, 0, 0.04);
  const edgeBoost = clamp(edge * 0.25, 0, 0.03);
  const sentimentBoost = clamp(sentiment * 0.25, -0.01, 0.02);
  const trustMultiplier = clamp(trust, 0.35, 1);

  return clamp((base + scoreBoost + edgeBoost + sentimentBoost) * trustMultiplier, 0, 0.05);
}

function buildAllocationReason(pick, stake) {
  if (stake <= 0) return "Skipped because portfolio risk budget is already used.";
  if (pick.decision === "BET") return "High-ranked Agent V7 pick inside risk limits.";
  if (pick.decision === "WATCH") return "Watch-level pick with small controlled exposure.";
  return "Included by allocation model.";
}

function classifyPortfolioRisk(allocations, bankroll) {
  const total = allocations.reduce((sum, item) => sum + item.suggestedStake, 0);
  const ratio = bankroll > 0 ? total / bankroll : 0;

  if (ratio >= 0.15) return "High";
  if (ratio >= 0.08) return "Medium";
  if (ratio > 0) return "Low";
  return "None";
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
