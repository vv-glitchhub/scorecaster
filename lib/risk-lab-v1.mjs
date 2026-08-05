export const RISK_LAB_VERSION = "scorecaster-bankroll-risk-lab-v1";

export const RISK_LAB_DEFAULTS = Object.freeze({
  simulations: 1500,
  rounds: 100,
  seed: "scorecaster-risk-lab-v1",
  kellyMode: "quarter",
  riskProfile: "balanced",
  flatStakePercent: 0.005,
  ruinThreshold: 0.5,
  overconfidenceShrink: 0.5,
  priceDeterioration: 0.08,
  probabilityShock: 0.02
});

export const RISK_LAB_ABSOLUTE_CAPS = Object.freeze({
  selection: 0.01,
  daily: 0.05,
  league: 0.025,
  portfolio: 0.05
});

export const RISK_PROFILES = Object.freeze({
  defensive: Object.freeze({ selection: 0.0025, daily: 0.01, league: 0.005, portfolio: 0.015 }),
  conservative: Object.freeze({ selection: 0.005, daily: 0.02, league: 0.01, portfolio: 0.025 }),
  balanced: Object.freeze({ selection: 0.01, daily: 0.05, league: 0.025, portfolio: 0.05 })
});

export const KELLY_MULTIPLIERS = Object.freeze({
  full: 1,
  half: 0.5,
  quarter: 0.25,
  conservative: 0.125
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const clean = (value, maximum = 180) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);
const average = (values = []) => {
  const eligible = values.filter(Number.isFinite);
  return eligible.length ? eligible.reduce((sum, value) => sum + value, 0) / eligible.length : 0;
};
const sum = (values = []) => values.filter(Number.isFinite).reduce((total, value) => total + value, 0);

function percentile(values, percentage) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = clamp(percentage, 0, 100) / 100 * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function hashSeed(value) {
  const text = String(value ?? RISK_LAB_DEFAULTS.seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRandom(random) {
  const first = Math.max(Number.EPSILON, random());
  const second = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function normalCdf(value) {
  const absolute = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absolute);
  const density = 0.3989422804014327 * Math.exp(-0.5 * absolute * absolute);
  const polynomial = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const positive = 1 - density * polynomial;
  return value >= 0 ? positive : 1 - positive;
}

export function calculateKellyFraction({ odds, probability } = {}) {
  const decimalOdds = finite(odds);
  const winProbability = finite(probability);
  if (decimalOdds === null || decimalOdds <= 1 || winProbability === null || winProbability <= 0 || winProbability >= 1) return 0;
  const netOdds = decimalOdds - 1;
  const loseProbability = 1 - winProbability;
  return round(clamp((netOdds * winProbability - loseProbability) / netOdds, 0, 1));
}

function normalizePick(record = {}, index = 0) {
  const odds = finite(record.odds);
  const modelProbability = finite(record.modelProbability ?? record.model_probability ?? record.probability);
  const marketProbability = finite(record.marketProbability ?? record.market_probability ?? record.consensusProbability ?? record.consensus_probability);
  const eventId = clean(record.eventId ?? record.event_id ?? record.gameId ?? record.game_id ?? record.id, 180);
  const league = clean(record.league ?? record.leagueTitle ?? record.sportTitle, 140) || "unknown";
  const sport = clean(record.sport ?? record.sportKey ?? record.sport_key, 100) || "unknown";
  const selection = clean(record.selection ?? record.label, 160) || `Selection ${index + 1}`;
  const explicitGroup = clean(record.correlationGroup ?? record.correlation_group, 160);
  const errors = [];

  if (odds === null || odds <= 1 || odds > 1000) errors.push("invalid-odds");
  if (modelProbability === null || modelProbability <= 0 || modelProbability >= 1) errors.push("invalid-model-probability");
  if (!eventId) errors.push("missing-event-id");

  const impliedProbability = odds && odds > 1 ? 1 / odds : null;
  const normalizedMarket = marketProbability !== null && marketProbability > 0 && marketProbability < 1
    ? marketProbability
    : impliedProbability;
  const correlationCoefficient = clamp(
    finite(record.correlationCoefficient ?? record.correlation_coefficient) ?? (eventId ? 0.45 : 0),
    0,
    0.85
  );

  return {
    id: clean(record.id, 180) || `${eventId || "event"}:${selection}:${index}`,
    eventId,
    league,
    sport,
    selection,
    bookmaker: clean(record.bookmaker, 120) || "unknown",
    odds,
    modelProbability,
    marketProbability: normalizedMarket,
    impliedProbability,
    fullKellyFraction: calculateKellyFraction({ odds, probability: modelProbability }),
    correlationGroup: explicitGroup || (eventId ? `event:${eventId}` : null),
    correlationCoefficient,
    correlationUnknown: record.correlationUnknown === true || record.correlation_unknown === true,
    errors
  };
}

function resolveCaps(profileName, requestedCaps = {}) {
  const profile = RISK_PROFILES[profileName] || RISK_PROFILES.balanced;
  const result = {};
  const overrideAttempts = [];
  for (const key of Object.keys(RISK_LAB_ABSOLUTE_CAPS)) {
    const requested = finite(requestedCaps?.[key]);
    if (requested !== null && requested > RISK_LAB_ABSOLUTE_CAPS[key]) {
      overrideAttempts.push({ key, requested: round(requested), hardMaximum: RISK_LAB_ABSOLUTE_CAPS[key] });
    }
    result[key] = clamp(
      requested === null ? profile[key] : requested,
      0,
      Math.min(profile[key], RISK_LAB_ABSOLUTE_CAPS[key])
    );
  }
  return { caps: result, profile, overrideAttempts };
}

function proportionalScale(items, key, maximum) {
  const total = sum(items.map((item) => item[key]));
  const scale = total > maximum && total > 0 ? maximum / total : 1;
  return { total, scale };
}

export function buildStakePlan({
  picks = [],
  bankroll = 1000,
  kellyMode = RISK_LAB_DEFAULTS.kellyMode,
  riskProfile = RISK_LAB_DEFAULTS.riskProfile,
  caps: requestedCaps = {}
} = {}) {
  const bank = clamp(finite(bankroll) ?? 1000, 1, 100000000);
  const multiplier = KELLY_MULTIPLIERS[kellyMode] ?? KELLY_MULTIPLIERS.quarter;
  const normalized = (Array.isArray(picks) ? picks : []).slice(0, 20).map(normalizePick);
  const rejected = normalized.filter((pick) => pick.errors.length);
  const eligible = normalized.filter((pick) => !pick.errors.length);
  const { caps, profile, overrideAttempts } = resolveCaps(riskProfile, requestedCaps);

  const groupCounts = eligible.reduce((counts, pick) => {
    const key = pick.correlationGroup || `independent:${pick.id}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const leagueCounts = eligible.reduce((counts, pick) => {
    counts[pick.league] = (counts[pick.league] || 0) + 1;
    return counts;
  }, {});

  let plan = eligible.map((pick) => {
    const groupSize = groupCounts[pick.correlationGroup || `independent:${pick.id}`] || 1;
    const leagueSize = leagueCounts[pick.league] || 1;
    const groupPenalty = groupSize > 1 ? 1 / (1 + 0.35 * (groupSize - 1)) : 1;
    const leaguePenalty = leagueSize > 3 ? 1 / (1 + 0.08 * (leagueSize - 3)) : 1;
    const unknownPenalty = pick.correlationUnknown ? 0.8 : 1;
    const correlationPenalty = clamp(groupPenalty * leaguePenalty * unknownPenalty, 0.35, 1);
    const rawFraction = pick.fullKellyFraction * multiplier;
    const afterCorrelation = rawFraction * correlationPenalty;
    const afterSelectionCap = Math.min(afterCorrelation, caps.selection);
    return {
      ...pick,
      kellyMode,
      kellyMultiplier: multiplier,
      rawFraction: round(rawFraction),
      correlationPenalty: round(correlationPenalty),
      afterCorrelation: round(afterCorrelation),
      afterSelectionCap: round(afterSelectionCap),
      finalFraction: afterSelectionCap,
      capReasons: [
        ...(afterCorrelation > caps.selection ? ["selection-cap"] : []),
        ...(correlationPenalty < 1 ? ["correlation-penalty"] : [])
      ]
    };
  });

  const byLeague = new Map();
  for (const item of plan) {
    if (!byLeague.has(item.league)) byLeague.set(item.league, []);
    byLeague.get(item.league).push(item);
  }
  for (const leagueItems of byLeague.values()) {
    const { scale } = proportionalScale(leagueItems, "finalFraction", caps.league);
    if (scale < 1) {
      for (const item of leagueItems) {
        item.finalFraction *= scale;
        item.capReasons.push("league-cap");
      }
    }
  }

  const portfolioMaximum = Math.min(caps.daily, caps.portfolio);
  const portfolioState = proportionalScale(plan, "finalFraction", portfolioMaximum);
  if (portfolioState.scale < 1) {
    plan = plan.map((item) => ({
      ...item,
      finalFraction: item.finalFraction * portfolioState.scale,
      capReasons: [...item.capReasons, "portfolio-cap"]
    }));
  }

  plan = plan.map((item) => ({
    ...item,
    finalFraction: round(item.finalFraction),
    stake: round(bank * item.finalFraction, 2),
    capped: item.capReasons.length > 0
  }));

  const exposure = {
    bankroll: bank,
    selectionMaximum: round(bank * caps.selection, 2),
    dailyMaximum: round(bank * caps.daily, 2),
    leagueMaximum: round(bank * caps.league, 2),
    portfolioMaximum: round(bank * caps.portfolio, 2),
    plannedFraction: round(sum(plan.map((item) => item.finalFraction))),
    plannedStake: round(sum(plan.map((item) => item.stake)), 2),
    byLeague: [...byLeague.keys()].map((league) => ({
      league,
      fraction: round(sum(plan.filter((item) => item.league === league).map((item) => item.finalFraction))),
      stake: round(sum(plan.filter((item) => item.league === league).map((item) => item.stake)), 2)
    })).sort((left, right) => right.fraction - left.fraction || left.league.localeCompare(right.league))
  };

  return {
    ok: eligible.length > 0,
    version: RISK_LAB_VERSION,
    bankroll: bank,
    kellyMode: KELLY_MULTIPLIERS[kellyMode] !== undefined ? kellyMode : "quarter",
    riskProfile: RISK_PROFILES[riskProfile] ? riskProfile : "balanced",
    profileCaps: profile,
    caps,
    hardCaps: RISK_LAB_ABSOLUTE_CAPS,
    overrideAttempts,
    received: normalized.length,
    eligible: eligible.length,
    rejected: rejected.map((pick) => ({ id: pick.id, selection: pick.selection, errors: pick.errors })),
    picks: plan,
    exposure,
    safety: {
      capOverridesAllowed: false,
      correlationCanIncreaseStake: false,
      negativeKellyCreatesStake: false,
      realMoneyExecution: false
    }
  };
}

function flatPlanFromStakePlan(stakePlan, flatStakePercent) {
  const active = stakePlan.picks.filter((pick) => pick.fullKellyFraction > 0);
  const fraction = clamp(finite(flatStakePercent) ?? RISK_LAB_DEFAULTS.flatStakePercent, 0, stakePlan.caps.selection);
  let plan = active.map((pick) => ({
    ...pick,
    finalFraction: round(fraction * pick.correlationPenalty),
    stake: null
  }));

  const leagues = new Map();
  for (const item of plan) {
    if (!leagues.has(item.league)) leagues.set(item.league, []);
    leagues.get(item.league).push(item);
  }
  for (const items of leagues.values()) {
    const { scale } = proportionalScale(items, "finalFraction", stakePlan.caps.league);
    if (scale < 1) for (const item of items) item.finalFraction *= scale;
  }
  const portfolioScale = proportionalScale(plan, "finalFraction", Math.min(stakePlan.caps.daily, stakePlan.caps.portfolio)).scale;
  if (portfolioScale < 1) plan = plan.map((item) => ({ ...item, finalFraction: item.finalFraction * portfolioScale }));
  return plan.map((item) => ({ ...item, finalFraction: round(item.finalFraction) }));
}

function applyScenario(pick, scenario, stress) {
  const market = clamp(pick.marketProbability ?? pick.impliedProbability ?? pick.modelProbability, 0.001, 0.999);
  let probability = pick.modelProbability;
  let odds = pick.odds;
  if (scenario === "overconfidence" || scenario === "combined-stress") {
    probability = market + (probability - market) * (1 - stress.overconfidenceShrink);
  }
  if (scenario === "probability-shock" || scenario === "combined-stress") {
    probability -= stress.probabilityShock;
  }
  if (scenario === "price-deterioration" || scenario === "combined-stress") {
    odds = 1 + (odds - 1) * (1 - stress.priceDeterioration);
  }
  return {
    ...pick,
    scenarioProbability: clamp(probability, 0.001, 0.999),
    scenarioOdds: Math.max(1.001, odds)
  };
}

function correlatedOutcomes(picks, random) {
  const groupNormals = new Map();
  for (const pick of picks) {
    if (pick.correlationGroup && !groupNormals.has(pick.correlationGroup)) {
      groupNormals.set(pick.correlationGroup, normalRandom(random));
    }
  }
  return picks.map((pick) => {
    const groupNormal = pick.correlationGroup ? groupNormals.get(pick.correlationGroup) : 0;
    const independentNormal = normalRandom(random);
    const rho = pick.correlationGroup ? clamp(pick.correlationCoefficient, 0, 0.85) : 0;
    const latent = Math.sqrt(rho) * groupNormal + Math.sqrt(1 - rho) * independentNormal;
    return normalCdf(latent) < pick.scenarioProbability;
  });
}

function simulateStrategy({ picks, fractions, outcomes, bankroll }) {
  let change = 0;
  let staked = 0;
  for (let index = 0; index < picks.length; index += 1) {
    const fraction = fractions.get(picks[index].id) || 0;
    const stake = bankroll * fraction;
    if (!(stake > 0)) continue;
    staked += stake;
    change += outcomes[index] ? stake * (picks[index].scenarioOdds - 1) : -stake;
  }
  return { change, staked };
}

function summarizeSimulation(records, initialBankroll) {
  const finalBankrolls = records.map((record) => record.finalBankroll);
  const returns = records.map((record) => record.finalBankroll / initialBankroll - 1);
  const drawdowns = records.map((record) => record.maximumDrawdown);
  const streaks = records.map((record) => record.longestLosingStreak);
  const totalStaked = records.map((record) => record.totalStaked);
  return {
    simulations: records.length,
    endingBankroll: {
      mean: round(average(finalBankrolls), 2),
      median: round(percentile(finalBankrolls, 50), 2),
      p05: round(percentile(finalBankrolls, 5), 2),
      p25: round(percentile(finalBankrolls, 25), 2),
      p75: round(percentile(finalBankrolls, 75), 2),
      p95: round(percentile(finalBankrolls, 95), 2)
    },
    returnDistribution: {
      mean: round(average(returns)),
      median: round(percentile(returns, 50)),
      p05: round(percentile(returns, 5)),
      p95: round(percentile(returns, 95))
    },
    probabilityOfLoss: round(records.filter((record) => record.finalBankroll < initialBankroll).length / records.length),
    riskOfRuin: round(records.filter((record) => record.ruined).length / records.length),
    probabilityOfBankruptcy: round(records.filter((record) => record.finalBankroll <= 0).length / records.length),
    maximumDrawdown: {
      median: round(percentile(drawdowns, 50)),
      p90: round(percentile(drawdowns, 90)),
      p95: round(percentile(drawdowns, 95)),
      maximum: round(Math.max(0, ...drawdowns))
    },
    losingStreak: {
      median: round(percentile(streaks, 50), 1),
      p90: round(percentile(streaks, 90), 1),
      p95: round(percentile(streaks, 95), 1),
      maximum: Math.max(0, ...streaks)
    },
    totalStaked: {
      mean: round(average(totalStaked), 2),
      median: round(percentile(totalStaked, 50), 2)
    }
  };
}

function runScenario({ stakePlan, flatPlan, simulations, rounds, seed, ruinThreshold, scenario, stress }) {
  const random = createRandom(`${seed}:${scenario}`);
  const activeIds = new Set([
    ...stakePlan.picks.filter((pick) => pick.finalFraction > 0).map((pick) => pick.id),
    ...flatPlan.filter((pick) => pick.finalFraction > 0).map((pick) => pick.id)
  ]);
  const picks = stakePlan.picks.filter((pick) => activeIds.has(pick.id)).map((pick) => applyScenario(pick, scenario, stress));
  const selectedFractions = new Map(stakePlan.picks.map((pick) => [pick.id, pick.finalFraction]));
  const flatFractions = new Map(flatPlan.map((pick) => [pick.id, pick.finalFraction]));
  const selectedRecords = [];
  const flatRecords = [];

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    const strategies = {
      selected: { bankroll: stakePlan.bankroll, peak: stakePlan.bankroll, maximumDrawdown: 0, totalStaked: 0, ruined: false },
      flat: { bankroll: stakePlan.bankroll, peak: stakePlan.bankroll, maximumDrawdown: 0, totalStaked: 0, ruined: false }
    };
    let currentStreak = 0;
    let longestStreak = 0;

    for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
      if (!picks.length) break;
      const outcomes = correlatedOutcomes(picks, random);
      for (const outcome of outcomes) {
        currentStreak = outcome ? 0 : currentStreak + 1;
        longestStreak = Math.max(longestStreak, currentStreak);
      }

      for (const [name, fractions] of [["selected", selectedFractions], ["flat", flatFractions]]) {
        const strategy = strategies[name];
        if (strategy.bankroll <= 0) continue;
        const result = simulateStrategy({ picks, fractions, outcomes, bankroll: strategy.bankroll });
        strategy.totalStaked += result.staked;
        strategy.bankroll = Math.max(0, strategy.bankroll + result.change);
        strategy.peak = Math.max(strategy.peak, strategy.bankroll);
        const drawdown = strategy.peak > 0 ? (strategy.peak - strategy.bankroll) / strategy.peak : 1;
        strategy.maximumDrawdown = Math.max(strategy.maximumDrawdown, drawdown);
        if (strategy.bankroll <= stakePlan.bankroll * ruinThreshold) strategy.ruined = true;
      }
    }

    selectedRecords.push({
      finalBankroll: strategies.selected.bankroll,
      maximumDrawdown: strategies.selected.maximumDrawdown,
      totalStaked: strategies.selected.totalStaked,
      ruined: strategies.selected.ruined,
      longestLosingStreak: longestStreak
    });
    flatRecords.push({
      finalBankroll: strategies.flat.bankroll,
      maximumDrawdown: strategies.flat.maximumDrawdown,
      totalStaked: strategies.flat.totalStaked,
      ruined: strategies.flat.ruined,
      longestLosingStreak: longestStreak
    });
  }

  return {
    scenario,
    assumptions: {
      overconfidenceShrink: scenario === "overconfidence" || scenario === "combined-stress" ? stress.overconfidenceShrink : 0,
      probabilityShock: scenario === "probability-shock" || scenario === "combined-stress" ? stress.probabilityShock : 0,
      priceDeterioration: scenario === "price-deterioration" || scenario === "combined-stress" ? stress.priceDeterioration : 0
    },
    selectedKelly: summarizeSimulation(selectedRecords, stakePlan.bankroll),
    flatStaking: summarizeSimulation(flatRecords, stakePlan.bankroll),
    zeroBet: {
      simulations,
      endingBankroll: { mean: stakePlan.bankroll, median: stakePlan.bankroll, p05: stakePlan.bankroll, p25: stakePlan.bankroll, p75: stakePlan.bankroll, p95: stakePlan.bankroll },
      returnDistribution: { mean: 0, median: 0, p05: 0, p95: 0 },
      probabilityOfLoss: 0,
      riskOfRuin: 0,
      probabilityOfBankruptcy: 0,
      maximumDrawdown: { median: 0, p90: 0, p95: 0, maximum: 0 },
      losingStreak: { median: 0, p90: 0, p95: 0, maximum: 0 },
      totalStaked: { mean: 0, median: 0 }
    }
  };
}

export function runRiskLab(input = {}) {
  const simulations = Math.round(clamp(finite(input.simulations) ?? RISK_LAB_DEFAULTS.simulations, 100, 5000));
  const rounds = Math.round(clamp(finite(input.rounds) ?? RISK_LAB_DEFAULTS.rounds, 1, 365));
  const seed = clean(input.seed, 120) || RISK_LAB_DEFAULTS.seed;
  const ruinThreshold = clamp(finite(input.ruinThreshold) ?? RISK_LAB_DEFAULTS.ruinThreshold, 0.05, 0.95);
  const stress = {
    overconfidenceShrink: clamp(finite(input.stress?.overconfidenceShrink) ?? RISK_LAB_DEFAULTS.overconfidenceShrink, 0, 1),
    priceDeterioration: clamp(finite(input.stress?.priceDeterioration) ?? RISK_LAB_DEFAULTS.priceDeterioration, 0, 0.5),
    probabilityShock: clamp(finite(input.stress?.probabilityShock) ?? RISK_LAB_DEFAULTS.probabilityShock, 0, 0.2)
  };
  const stakePlan = buildStakePlan({
    picks: input.picks,
    bankroll: input.bankroll,
    kellyMode: input.kellyMode,
    riskProfile: input.riskProfile,
    caps: input.caps
  });
  const flatPlan = flatPlanFromStakePlan(stakePlan, input.flatStakePercent);
  const scenarios = ["baseline", "overconfidence", "price-deterioration", "combined-stress"].map((scenario) => runScenario({
    stakePlan,
    flatPlan,
    simulations,
    rounds,
    seed,
    ruinThreshold,
    scenario,
    stress
  }));

  return {
    ok: stakePlan.ok,
    version: RISK_LAB_VERSION,
    generatedAt: new Date().toISOString(),
    paperOnly: true,
    status: stakePlan.picks.some((pick) => pick.finalFraction > 0) ? "simulated" : "no-positive-kelly-exposure",
    input: {
      simulations,
      rounds,
      seed,
      bankroll: stakePlan.bankroll,
      kellyMode: stakePlan.kellyMode,
      riskProfile: stakePlan.riskProfile,
      ruinThreshold,
      flatStakePercent: clamp(finite(input.flatStakePercent) ?? RISK_LAB_DEFAULTS.flatStakePercent, 0, stakePlan.caps.selection),
      stress
    },
    stakePlan,
    scenarios,
    methodology: {
      kelly: "f* = ((decimal_odds - 1) * p - (1 - p)) / (decimal_odds - 1)",
      fractionalKelly: "stake_fraction = max(0, f*) * selected_multiplier",
      correlationPenalty: "same-event and uncertain-correlation groups reduce stake before hard caps",
      simulation: "seeded correlated Bernoulli outcomes using a Gaussian latent-factor approximation",
      drawdown: "(running_peak - bankroll) / running_peak",
      riskOfRuin: "share of simulations crossing the configured bankroll threshold",
      stress: "model edge shrink, probability shock and net-odds deterioration",
      zeroBetBaseline: "bankroll remains unchanged"
    },
    limitations: [
      "Correlation coefficients are conservative assumptions unless supplied from validated evidence.",
      "Simulation output depends on the supplied probabilities and does not prove future profitability.",
      "Market limits, account restrictions, tax and real-money execution are outside this paper-only model."
    ],
    safety: {
      hardCapsCanBeOverridden: false,
      correlationCanIncreaseStake: false,
      guaranteedProfitClaim: false,
      bookmakerAccountConnection: false,
      depositsOrWithdrawals: false,
      realMoneyExecution: false,
      randomSeedReproducible: true
    }
  };
}
