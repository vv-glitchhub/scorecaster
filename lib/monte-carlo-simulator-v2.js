export function runMonteCarloSimulatorV2({
  pick = {},
  simulations = 10000,
  bankroll = 1000,
  stake = null,
  horizon = 100,
  riskOfRuinThreshold = 0.5
} = {}) {
  const simCount = clampInt(simulations, 100, 50000);
  const bank = Number(bankroll || 1000);
  const odds = Number(pick.odds || 0);
  const probability = clamp(Number(pick.modelProbability || pick.probability || 0.5), 0.01, 0.99);
  const stakeAmount = Number(stake ?? pick.suggestedStake ?? calculateQuarterKellyStake({ bankroll: bank, odds, probability }));

  if (!odds || odds <= 1) {
    return {
      ok: false,
      source: "monte-carlo-simulator-v2",
      error: "Valid decimal odds are required."
    };
  }

  const singleBetReturns = [];
  const bankrollOutcomes = [];
  const ruinThreshold = bank * Number(riskOfRuinThreshold || 0.5);
  let ruinCount = 0;

  for (let i = 0; i < simCount; i += 1) {
    const win = Math.random() < probability;
    const profit = win ? stakeAmount * (odds - 1) : -stakeAmount;
    singleBetReturns.push(profit);

    let simulatedBankroll = bank;
    let ruined = false;

    for (let n = 0; n < horizon; n += 1) {
      const roundWin = Math.random() < probability;
      const roundProfit = roundWin ? stakeAmount * (odds - 1) : -stakeAmount;
      simulatedBankroll += roundProfit;

      if (simulatedBankroll <= ruinThreshold) ruined = true;
      if (simulatedBankroll <= 0) {
        simulatedBankroll = 0;
        ruined = true;
        break;
      }
    }

    if (ruined) ruinCount += 1;
    bankrollOutcomes.push(simulatedBankroll);
  }

  return {
    ok: true,
    source: "monte-carlo-simulator-v2",
    generatedAt: new Date().toISOString(),
    input: {
      simulations: simCount,
      bankroll: bank,
      stake: roundMoney(stakeAmount),
      odds,
      probability,
      horizon,
      riskOfRuinThreshold
    },
    singleBet: summarizeDistribution(singleBetReturns),
    bankrollSimulation: {
      ...summarizeDistribution(bankrollOutcomes),
      riskOfRuin: ruinCount / simCount,
      ruinThreshold: roundMoney(ruinThreshold)
    },
    kelly: buildKellySummary({ bankroll: bank, odds, probability, stake: stakeAmount }),
    confidenceIntervals: {
      profit95: percentileRange(singleBetReturns, 2.5, 97.5),
      bankroll95: percentileRange(bankrollOutcomes, 2.5, 97.5),
      bankroll80: percentileRange(bankrollOutcomes, 10, 90)
    },
    interpretation: buildInterpretation({ probability, odds, stakeAmount, bank, ruinCount, simCount, bankrollOutcomes })
  };
}

export function runPortfolioMonteCarloV2({
  picks = [],
  simulations = 10000,
  bankroll = 1000,
  horizon = 1,
  riskOfRuinThreshold = 0.5
} = {}) {
  const simCount = clampInt(simulations, 100, 50000);
  const safePicks = Array.isArray(picks) ? picks : [];
  const bank = Number(bankroll || 1000);
  const ruinThreshold = bank * Number(riskOfRuinThreshold || 0.5);
  const outcomes = [];
  let ruinCount = 0;

  for (let i = 0; i < simCount; i += 1) {
    let simulatedBankroll = bank;

    for (let h = 0; h < horizon; h += 1) {
      for (const pick of safePicks) {
        const odds = Number(pick.odds || 0);
        if (!odds || odds <= 1) continue;

        const probability = clamp(Number(pick.modelProbability || pick.probability || 0.5), 0.01, 0.99);
        const stake = Number(pick.suggestedStake || pick.stake || calculateQuarterKellyStake({ bankroll: simulatedBankroll, odds, probability }));
        const win = Math.random() < probability;
        simulatedBankroll += win ? stake * (odds - 1) : -stake;

        if (simulatedBankroll <= 0) {
          simulatedBankroll = 0;
          break;
        }
      }

      if (simulatedBankroll <= 0) break;
    }

    if (simulatedBankroll <= ruinThreshold) ruinCount += 1;
    outcomes.push(simulatedBankroll);
  }

  return {
    ok: true,
    source: "portfolio-monte-carlo-v2",
    generatedAt: new Date().toISOString(),
    input: {
      simulations: simCount,
      picks: safePicks.length,
      bankroll: bank,
      horizon,
      riskOfRuinThreshold
    },
    bankrollSimulation: {
      ...summarizeDistribution(outcomes),
      riskOfRuin: ruinCount / simCount,
      ruinThreshold: roundMoney(ruinThreshold)
    },
    confidenceIntervals: {
      bankroll95: percentileRange(outcomes, 2.5, 97.5),
      bankroll80: percentileRange(outcomes, 10, 90)
    },
    interpretation: buildPortfolioInterpretation({ outcomes, bank, ruinCount, simCount })
  };
}

function buildKellySummary({ bankroll, odds, probability, stake }) {
  const fullKellyFraction = calculateKellyFraction({ odds, probability });
  const quarterKellyStake = bankroll * Math.max(0, fullKellyFraction * 0.25);
  const stakeFraction = bankroll > 0 ? stake / bankroll : 0;

  return {
    fullKellyFraction,
    quarterKellyFraction: Math.max(0, fullKellyFraction * 0.25),
    quarterKellyStake: roundMoney(quarterKellyStake),
    currentStakeFraction: stakeFraction,
    currentStake: roundMoney(stake),
    mode: stakeFraction > fullKellyFraction ? "above_full_kelly" : stakeFraction > fullKellyFraction * 0.25 ? "above_quarter_kelly" : "conservative"
  };
}

function calculateQuarterKellyStake({ bankroll, odds, probability }) {
  const fraction = calculateKellyFraction({ odds, probability });
  return Math.max(0, bankroll * fraction * 0.25);
}

function calculateKellyFraction({ odds, probability }) {
  const b = Number(odds || 0) - 1;
  const p = Number(probability || 0);
  const q = 1 - p;
  if (!b || b <= 0) return 0;
  return clamp((b * p - q) / b, 0, 1);
}

function summarizeDistribution(values = []) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    mean: roundMoney(average(sorted)),
    median: roundMoney(percentile(sorted, 50)),
    min: roundMoney(sorted[0] || 0),
    max: roundMoney(sorted[sorted.length - 1] || 0),
    p05: roundMoney(percentile(sorted, 5)),
    p25: roundMoney(percentile(sorted, 25)),
    p75: roundMoney(percentile(sorted, 75)),
    p95: roundMoney(percentile(sorted, 95)),
    standardDeviation: roundMoney(standardDeviation(sorted))
  };
}

function percentileRange(values, low, high) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    low: roundMoney(percentile(sorted, low)),
    high: roundMoney(percentile(sorted, high))
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const avg = average(values);
  const variance = average(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function buildInterpretation({ probability, odds, stakeAmount, bank, ruinCount, simCount, bankrollOutcomes }) {
  const implied = 1 / odds;
  const edge = probability - implied;
  const averageEndingBankroll = average(bankrollOutcomes);
  const expectedGrowth = bank > 0 ? (averageEndingBankroll - bank) / bank : 0;
  const riskOfRuin = ruinCount / simCount;

  const notes = [];
  if (edge > 0.03) notes.push("Model probability is meaningfully above implied probability.");
  if (edge < 0) notes.push("Model probability is below implied probability; paper exposure should be avoided or reduced.");
  if (riskOfRuin > 0.15) notes.push("Risk of ruin is elevated in this simulation setup.");
  if (stakeAmount / bank > 0.05) notes.push("Stake is large relative to bankroll; consider tighter paper risk limits.");
  if (!notes.length) notes.push("Simulation profile is balanced under current assumptions.");

  return {
    impliedProbability: implied,
    modelEdge: edge,
    expectedGrowth,
    riskOfRuin,
    notes
  };
}

function buildPortfolioInterpretation({ outcomes, bank, ruinCount, simCount }) {
  const mean = average(outcomes);
  const expectedGrowth = bank > 0 ? (mean - bank) / bank : 0;
  const riskOfRuin = ruinCount / simCount;
  const notes = [];

  if (expectedGrowth > 0.03) notes.push("Portfolio simulation shows positive expected paper growth.");
  if (expectedGrowth < 0) notes.push("Portfolio simulation shows negative expected paper growth.");
  if (riskOfRuin > 0.15) notes.push("Portfolio risk of ruin is elevated; reduce exposure or horizon.");
  if (!notes.length) notes.push("Portfolio simulation is balanced under current assumptions.");

  return { expectedGrowth, riskOfRuin, notes };
}

function average(values = []) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value, min, max) {
  return Math.round(clamp(Number(value || min), min, max));
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
