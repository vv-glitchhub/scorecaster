export function buildPortfolioIntelligenceV3({ portfolio = {}, history = [] } = {}) {
  const allocations = Array.isArray(portfolio.allocations) ? portfolio.allocations : [];
  const records = Array.isArray(history) ? history : [];
  const bankroll = Number(portfolio.bankroll || 1000);
  const allocated = Number(portfolio.allocated || 0);

  return {
    ok: true,
    source: "portfolio-intelligence-v3",
    generatedAt: new Date().toISOString(),
    bankroll,
    allocated,
    utilization: bankroll > 0 ? allocated / bankroll : 0,
    exposureByLeague: groupExposure(allocations, bankroll, "league"),
    exposureByMarket: groupExposure(allocations, bankroll, "marketKey"),
    exposureByDecision: groupExposure(allocations, bankroll, "decision"),
    drawdown: calculateDrawdown(records),
    kelly: calculateKellyTracking(allocations),
    heatmap: buildRiskHeatmap(allocations, bankroll),
    warnings: buildPortfolioWarnings({ portfolio, allocations, bankroll, allocated })
  };
}

function groupExposure(allocations, bankroll, key) {
  const grouped = new Map();

  for (const allocation of allocations) {
    const name = allocation[key] || allocation.league || allocation.market || allocation.decision || "Unknown";
    const current = grouped.get(name) || { name, stake: 0, count: 0, averageScore: 0, decisions: {} };
    current.stake += Number(allocation.suggestedStake || 0);
    current.count += 1;
    current.averageScore += Number(allocation.finalScore100 || allocation.finalScore || 0);
    current.decisions[allocation.decision || "Unknown"] = (current.decisions[allocation.decision || "Unknown"] || 0) + 1;
    grouped.set(name, current);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      stake: roundMoney(item.stake),
      exposurePercent: bankroll > 0 ? item.stake / bankroll : 0,
      averageScore: item.count > 0 ? item.averageScore / item.count : 0,
      riskLevel: classifyExposure(item.stake, bankroll)
    }))
    .sort((a, b) => b.stake - a.stake);
}

function calculateDrawdown(records) {
  let balance = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const curve = [];

  for (const record of records) {
    balance += Number(record.profit || 0);
    peak = Math.max(peak, balance);
    const drawdown = peak - balance;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    curve.push({
      createdAt: record.createdAt || record.created_at || null,
      balance: roundMoney(balance),
      drawdown: roundMoney(drawdown)
    });
  }

  return {
    currentBalance: roundMoney(balance),
    peak: roundMoney(peak),
    maxDrawdown: roundMoney(maxDrawdown),
    curve
  };
}

function calculateKellyTracking(allocations) {
  const totalSuggested = allocations.reduce((sum, item) => sum + Number(item.suggestedStake || 0), 0);
  const totalKelly = allocations.reduce((sum, item) => sum + Number(item.kellyStake || 0), 0);
  const ratio = totalKelly > 0 ? totalSuggested / totalKelly : 0;

  return {
    totalSuggested: roundMoney(totalSuggested),
    totalKelly: roundMoney(totalKelly),
    suggestedToKellyRatio: ratio,
    mode: ratio > 1.05 ? "above_kelly" : ratio < 0.6 ? "conservative" : "balanced"
  };
}

function buildRiskHeatmap(allocations, bankroll) {
  return allocations.map((allocation) => {
    const stake = Number(allocation.suggestedStake || 0);
    const exposurePercent = bankroll > 0 ? stake / bankroll : 0;
    const score = Number(allocation.finalScore100 || allocation.finalScore || 0);
    const riskPoints = exposurePercent * 100 + (allocation.exposure === "High" ? 15 : allocation.exposure === "Medium" ? 7 : 0) - score * 0.05;

    return {
      selection: allocation.selection,
      match: allocation.match || `${allocation.homeTeam || ""} vs ${allocation.awayTeam || ""}`.trim(),
      league: allocation.league,
      decision: allocation.decision,
      stake,
      exposurePercent,
      score,
      riskScore: Math.max(0, riskPoints),
      riskLevel: classifyRiskScore(riskPoints)
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

function buildPortfolioWarnings({ portfolio, allocations, bankroll, allocated }) {
  const warnings = Array.isArray(portfolio.riskWarnings) ? [...portfolio.riskWarnings] : [];
  const utilization = bankroll > 0 ? allocated / bankroll : 0;

  if (utilization > 0.12) warnings.push("Paper portfolio utilization is high.");
  if (allocations.length > 12) warnings.push("Many simultaneous paper positions. Consider narrowing to the strongest picks.");

  const highExposure = allocations.filter((item) => item.exposure === "High");
  if (highExposure.length) warnings.push(`${highExposure.length} high exposure paper positions detected.`);

  if (!warnings.length) warnings.push("Portfolio risk profile looks balanced for paper tracking.");
  return warnings;
}

function classifyExposure(stake, bankroll) {
  const ratio = bankroll > 0 ? stake / bankroll : 0;
  if (ratio >= 0.05) return "High";
  if (ratio >= 0.025) return "Medium";
  if (ratio > 0) return "Low";
  return "None";
}

function classifyRiskScore(score) {
  if (score >= 12) return "High";
  if (score >= 6) return "Medium";
  if (score > 0) return "Low";
  return "None";
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
