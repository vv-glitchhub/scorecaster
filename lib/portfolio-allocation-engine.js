export function buildPortfolioAllocation({
  picks = [],
  bankroll = 1000,
  maxPortfolioRisk = 0.12,
  maxSingleStake = 0.04,
  minFinalScore = 0.045,
  currentDrawdown = 0,
  dailyLossLimit = 0.06,
  weeklyLossLimit = 0.14
}) {
  const bank = Number(bankroll || 1000);
  const drawdown = Number(currentDrawdown || 0);
  const riskMultiplier = calculateRiskMultiplier({ drawdown, dailyLossLimit, weeklyLossLimit });

  const filtered = picks
    .filter((pick) => ["BET", "WATCH"].includes(pick.decision))
    .filter((pick) => getNormalizedScore(pick) >= minFinalScore)
    .sort((a, b) => getNormalizedScore(b) - getNormalizedScore(a));

  const totalRiskBudget = bank * Number(maxPortfolioRisk || 0.12) * riskMultiplier;
  const maxPerBet = bank * Number(maxSingleStake || 0.04) * riskMultiplier;

  let usedBudget = 0;

  const allocations = filtered.map((pick, index) => {
    const confidenceWeight = calculateConfidenceWeight(pick) * riskMultiplier;
    const kellyStake = calculateKellyStake({ bankroll: bank, pick, maxPerBet });
    const rawStake = Math.min(bank * confidenceWeight, kellyStake || bank * confidenceWeight);
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
      finalScore100: Number(pick.finalScore100 || 0),
      gradeV9: pick.gradeV9 || "N/A",
      edge: Number(pick.edge || 0),
      sourceTrust: Number(pick.sourceTrust || 0),
      sentimentScore: Number(pick.sentimentScore || 0),
      qualityScore: Number(pick.qualityScore || 0),
      qualityGrade: pick.qualityGrade || "N/A",
      matchContextGrade: pick.matchContextGrade || "N/A",
      sharpMoneyLabel: pick.sharpMoneyLabel || "Neutral",
      qualityNotes: pick.qualityNotes || [],
      suggestedStake: roundMoney(cappedStake),
      stakePercent: bank > 0 ? cappedStake / bank : 0,
      kellyStake: roundMoney(kellyStake),
      exposure: classifyExposure(cappedStake, bank),
      reason: buildAllocationReason(pick, cappedStake)
    };
  }).filter((item) => item.suggestedStake > 0);

  const allocated = allocations.reduce((sum, item) => sum + item.suggestedStake, 0);
  const exposureByLeague = groupExposureByLeague(allocations, bank);

  return {
    bankroll: bank,
    maxPortfolioRisk,
    maxSingleStake,
    minFinalScore,
    currentDrawdown: drawdown,
    dailyLossLimit,
    weeklyLossLimit,
    riskMultiplier,
    totalRiskBudget: roundMoney(totalRiskBudget),
    allocated: roundMoney(allocated),
    remainingRiskBudget: roundMoney(totalRiskBudget - allocated),
    count: allocations.length,
    riskLevel: classifyPortfolioRisk(allocations, bank),
    exposureByLeague,
    riskWarnings: buildRiskWarnings({ allocations, bank, allocated, drawdown, exposureByLeague }),
    allocations
  };
}

function getNormalizedScore(pick) {
  if (Number(pick.finalScore100 || 0) > 0) return Number(pick.finalScore100 || 0) / 100;
  return Number(pick.finalScore || 0);
}

function calculateConfidenceWeight(pick) {
  const score = getNormalizedScore(pick);
  const edge = Number(pick.edge || 0);
  const trust = Number(pick.sourceTrust || 0.4);
  const sentiment = Number(pick.sentimentScore || 0);
  const quality = Number(pick.qualityScore || 0);
  const sharp = Number(pick.sharpMoneyScore || 0);
  const context = Number(pick.matchContextScore || 0);

  const base = pick.decision === "BET" ? 0.012 : 0.006;
  const scoreBoost = clamp(score * 0.1, 0, 0.035);
  const edgeBoost = clamp(edge * 0.22, 0, 0.025);
  const sentimentBoost = clamp(sentiment * 0.2, -0.008, 0.018);
  const qualityBoost = clamp(quality * 0.012, 0, 0.012);
  const sharpBoost = clamp(sharp * 0.18, -0.01, 0.018);
  const contextBoost = clamp(context * 0.14, -0.012, 0.015);
  const trustMultiplier = clamp(trust || 0.4, 0.35, 1);

  return clamp((base + scoreBoost + edgeBoost + sentimentBoost + qualityBoost + sharpBoost + contextBoost) * trustMultiplier, 0, 0.04);
}

function calculateKellyStake({ bankroll, pick, maxPerBet }) {
  const odds = Number(pick.odds || 0);
  const probability = Number(pick.modelProbability || 0);

  if (!odds || odds <= 1 || !probability) return 0;

  const b = odds - 1;
  const q = 1 - probability;
  const fullKelly = (b * probability - q) / b;
  const quarterKelly = Math.max(0, fullKelly * 0.25);

  return Math.min(bankroll * quarterKelly, maxPerBet);
}

function calculateRiskMultiplier({ drawdown, dailyLossLimit, weeklyLossLimit }) {
  const dd = Math.abs(Number(drawdown || 0));
  const daily = Number(dailyLossLimit || 0.06);
  const weekly = Number(weeklyLossLimit || 0.14);

  if (dd >= weekly) return 0.25;
  if (dd >= daily) return 0.5;
  if (dd >= daily * 0.5) return 0.75;
  return 1;
}

function groupExposureByLeague(allocations, bankroll) {
  const grouped = {};

  for (const allocation of allocations) {
    const league = allocation.league || "Unknown";
    grouped[league] = grouped[league] || { league, stake: 0, count: 0, exposurePercent: 0 };
    grouped[league].stake += allocation.suggestedStake;
    grouped[league].count += 1;
  }

  return Object.values(grouped)
    .map((item) => ({
      ...item,
      stake: roundMoney(item.stake),
      exposurePercent: bankroll > 0 ? item.stake / bankroll : 0
    }))
    .sort((a, b) => b.stake - a.stake);
}

function buildRiskWarnings({ allocations, bank, allocated, drawdown, exposureByLeague }) {
  const warnings = [];
  const totalExposure = bank > 0 ? allocated / bank : 0;

  if (totalExposure >= 0.12) warnings.push("Portfolio exposure is high. Consider reducing paper stakes.");
  if (Math.abs(drawdown) >= 0.06) warnings.push("Drawdown detected. Risk multiplier has reduced paper staking.");

  for (const league of exposureByLeague) {
    if (league.exposurePercent >= 0.06) {
      warnings.push(`High league exposure in ${league.league}.`);
    }
  }

  if (!allocations.length) warnings.push("No allocations passed the current risk filters.");
  return warnings;
}

function buildAllocationReason(pick, stake) {
  if (stake <= 0) return "Skipped because portfolio risk budget is already used.";
  if (pick.decision === "BET") return "High-ranked Agent V9 paper pick inside bankroll and risk limits.";
  if (pick.decision === "WATCH") return "Watch-level pick with small controlled paper exposure.";
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

function classifyExposure(stake, bankroll) {
  const ratio = bankroll > 0 ? stake / bankroll : 0;
  if (ratio >= 0.04) return "High";
  if (ratio >= 0.02) return "Medium";
  if (ratio > 0) return "Low";
  return "None";
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
