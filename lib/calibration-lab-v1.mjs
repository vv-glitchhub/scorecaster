export const CALIBRATION_LAB_VERSION = "scorecaster-calibration-lab-v1";

export const CALIBRATION_DEFAULTS = Object.freeze({
  probabilityEpsilon: 1e-6,
  calibrationBins: 10,
  minimumUsableSample: 100,
  minimumProvisionalSample: 30,
  minimumSliceSample: 20,
  closingFreshnessMinutes: 30,
  minimumClosingProviders: 2
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);
const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const average = (values = []) => {
  const eligible = values.filter((value) => Number.isFinite(value));
  return eligible.length ? eligible.reduce((sum, value) => sum + value, 0) / eligible.length : null;
};
const sum = (values = []) => values.filter((value) => Number.isFinite(value)).reduce((total, value) => total + value, 0);

export function binaryBrierScore(probability, outcome) {
  const p = finite(probability);
  const y = finite(outcome);
  if (p === null || y === null || p < 0 || p > 1 || ![0, 1].includes(y)) return null;
  return round((p - y) ** 2);
}

export function multiclassBrierScore(probabilities = [], outcomeIndex) {
  if (!Array.isArray(probabilities) || probabilities.length < 2) return null;
  const values = probabilities.map(finite);
  const index = Number(outcomeIndex);
  if (values.some((value) => value === null || value < 0 || value > 1) || !Number.isInteger(index) || index < 0 || index >= values.length) return null;
  const total = values.reduce((accumulator, probability, currentIndex) => {
    const outcome = currentIndex === index ? 1 : 0;
    return accumulator + (probability - outcome) ** 2;
  }, 0);
  return round(total);
}

export function binaryLogLoss(probability, outcome, epsilon = CALIBRATION_DEFAULTS.probabilityEpsilon) {
  const p = finite(probability);
  const y = finite(outcome);
  if (p === null || y === null || p < 0 || p > 1 || ![0, 1].includes(y)) return null;
  const bounded = clamp(p, epsilon, 1 - epsilon);
  return round(-(y * Math.log(bounded) + (1 - y) * Math.log(1 - bounded)));
}

export function multiclassLogLoss(probabilities = [], outcomeIndex, epsilon = CALIBRATION_DEFAULTS.probabilityEpsilon) {
  if (!Array.isArray(probabilities) || probabilities.length < 2) return null;
  const values = probabilities.map(finite);
  const index = Number(outcomeIndex);
  if (values.some((value) => value === null || value < 0 || value > 1) || !Number.isInteger(index) || index < 0 || index >= values.length) return null;
  return round(-Math.log(clamp(values[index], epsilon, 1 - epsilon)));
}

export function priceClv(entryOdds, closingNoVigProbability) {
  const entry = finite(entryOdds);
  const closeProbability = finite(closingNoVigProbability);
  if (entry === null || entry <= 1 || closeProbability === null || closeProbability <= 0 || closeProbability >= 1) return null;
  const closingFairOdds = 1 / closeProbability;
  return {
    entryOdds: round(entry, 4),
    closingFairOdds: round(closingFairOdds, 4),
    value: round(entry / closingFairOdds - 1),
    percent: round((entry / closingFairOdds - 1) * 100, 4),
    positive: entry > closingFairOdds
  };
}

export function probabilityClv(entryMarketProbability, closingNoVigProbability) {
  const entry = finite(entryMarketProbability);
  const close = finite(closingNoVigProbability);
  if (entry === null || close === null || entry <= 0 || entry >= 1 || close <= 0 || close >= 1) return null;
  return {
    entryProbability: round(entry),
    closingProbability: round(close),
    value: round(close - entry),
    percentagePoints: round((close - entry) * 100, 4),
    positive: close > entry
  };
}

export function wilsonInterval(successes, total, z = 1.96) {
  const n = Number(total);
  const x = Number(successes);
  if (!Number.isFinite(n) || !Number.isFinite(x) || n <= 0 || x < 0 || x > n) return null;
  const proportion = x / n;
  const denominator = 1 + (z ** 2) / n;
  const center = (proportion + (z ** 2) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((proportion * (1 - proportion) + (z ** 2) / (4 * n)) / n)) / denominator;
  return { lower: round(clamp(center - margin, 0, 1)), upper: round(clamp(center + margin, 0, 1)), confidence: 0.95 };
}

export function sampleStatus(count, configuration = {}) {
  const provisional = Number(configuration.minimumProvisionalSample ?? CALIBRATION_DEFAULTS.minimumProvisionalSample);
  const usable = Number(configuration.minimumUsableSample ?? CALIBRATION_DEFAULTS.minimumUsableSample);
  const value = Number(count || 0);
  if (value >= usable) return { level: "usable", count: value, minimumRequired: usable, promotionEligibleBySample: true };
  if (value >= provisional) return { level: "provisional", count: value, minimumRequired: usable, promotionEligibleBySample: false };
  return { level: "insufficient", count: value, minimumRequired: provisional, promotionEligibleBySample: false };
}

function normalizeObservation(record = {}) {
  const outcome = finite(record.outcome_value ?? record.outcomeValue);
  const modelProbability = finite(record.model_probability ?? record.modelProbability);
  const entryMarketProbability = finite(record.entry_market_probability ?? record.entryMarketProbability);
  const closingProbability = finite(record.closing_consensus_probability ?? record.closingConsensusProbability);
  const entryOdds = finite(record.entry_odds ?? record.entryOdds);
  const closingFairOdds = finite(record.closing_fair_odds ?? record.closingFairOdds) || (closingProbability > 0 ? 1 / closingProbability : null);
  const stake = finite(record.stake) ?? 0;
  const profit = finite(record.profit);
  const exclusionReason = clean(record.exclusion_reason ?? record.exclusionReason, 120) || null;
  const settledAt = iso(record.settled_at ?? record.settledAt);
  const createdAt = iso(record.bet_created_at ?? record.betCreatedAt ?? record.created_at ?? record.createdAt);
  const kickoffAt = iso(record.commence_time ?? record.commenceTime);
  const closingCapturedAt = iso(record.closing_captured_at ?? record.closingCapturedAt);
  const eligible = !exclusionReason && [0, 1].includes(outcome) && modelProbability !== null && modelProbability > 0 && modelProbability < 1 && closingProbability !== null && closingProbability > 0 && closingProbability < 1 && entryOdds !== null && entryOdds > 1;
  return {
    id: clean(record.id, 80),
    betId: clean(record.bet_id ?? record.betId, 80),
    eventId: clean(record.event_id ?? record.eventId, 180),
    sport: clean(record.sport, 100) || "unknown",
    league: clean(record.league, 140) || "unknown",
    market: clean(record.market, 80) || "h2h",
    selection: clean(record.selection ?? record.label, 160),
    bookmaker: clean(record.bookmaker, 120) || "unknown",
    decision: clean(record.decision, 30).toUpperCase() || "UNKNOWN",
    modelVersion: clean(record.model_version ?? record.modelVersion, 120) || "unknown",
    entryOdds,
    entryMarketProbability,
    modelProbability,
    closingConsensusProbability: closingProbability,
    closingFairOdds,
    closingProviderCount: finite(record.closing_provider_count ?? record.closingProviderCount) ?? 0,
    closingCapturedAt,
    outcomeValue: outcome,
    status: clean(record.status, 30).toLowerCase(),
    stake,
    profit,
    createdAt,
    kickoffAt,
    settledAt,
    exclusionReason,
    eligible,
    priceClv: finite(record.price_clv ?? record.priceClv) ?? priceClv(entryOdds, closingProbability)?.value ?? null,
    probabilityClv: finite(record.probability_clv ?? record.probabilityClv) ?? probabilityClv(entryMarketProbability, closingProbability)?.value ?? null,
    brier: finite(record.brier_score ?? record.brierScore) ?? binaryBrierScore(modelProbability, outcome),
    logLoss: finite(record.log_loss ?? record.logLoss) ?? binaryLogLoss(modelProbability, outcome),
    raw: record
  };
}

export function calibrationBins(observations = [], options = {}) {
  const count = Math.max(2, Math.min(20, Number(options.binCount || CALIBRATION_DEFAULTS.calibrationBins)));
  const bins = Array.from({ length: count }, (_, index) => ({
    index,
    lower: index / count,
    upper: (index + 1) / count,
    probabilities: [],
    outcomes: []
  }));
  for (const observation of observations) {
    if (!observation.eligible) continue;
    const index = Math.min(count - 1, Math.floor(observation.modelProbability * count));
    bins[index].probabilities.push(observation.modelProbability);
    bins[index].outcomes.push(observation.outcomeValue);
  }
  return bins.map((bin) => {
    const n = bin.outcomes.length;
    const successes = sum(bin.outcomes);
    const predicted = average(bin.probabilities);
    const observed = n ? successes / n : null;
    return {
      index: bin.index,
      lower: round(bin.lower, 3),
      upper: round(bin.upper, 3),
      count: n,
      predicted: round(predicted),
      observed: round(observed),
      absoluteGap: predicted !== null && observed !== null ? round(Math.abs(predicted - observed)) : null,
      observedInterval: wilsonInterval(successes, n)
    };
  });
}

function maximumDrawdown(observations) {
  let balance = 0;
  let peak = 0;
  let maximum = 0;
  for (const observation of [...observations].sort((left, right) => Date.parse(left.settledAt || left.createdAt || 0) - Date.parse(right.settledAt || right.createdAt || 0))) {
    if (!Number.isFinite(observation.profit)) continue;
    balance += observation.profit;
    peak = Math.max(peak, balance);
    maximum = Math.max(maximum, peak - balance);
  }
  return round(maximum, 4);
}

function oddsBucket(value) {
  const odds = finite(value);
  if (odds === null) return "unknown";
  if (odds < 1.5) return "1.01-1.49";
  if (odds < 2) return "1.50-1.99";
  if (odds < 3) return "2.00-2.99";
  if (odds < 5) return "3.00-4.99";
  return "5.00+";
}

function summarizeGroup(records, configuration) {
  const eligible = records.filter((record) => record.eligible);
  const outcomes = eligible.map((record) => record.outcomeValue);
  const successes = sum(outcomes);
  const stakeTotal = sum(eligible.map((record) => record.stake));
  const profitTotal = sum(eligible.map((record) => record.profit));
  const status = sampleStatus(eligible.length, configuration);
  return {
    count: eligible.length,
    received: records.length,
    excluded: records.length - eligible.length,
    sampleStatus: status,
    averagePriceClv: round(average(eligible.map((record) => record.priceClv))),
    averageProbabilityClv: round(average(eligible.map((record) => record.probabilityClv))),
    positivePriceClvRate: eligible.length ? round(eligible.filter((record) => record.priceClv > 0).length / eligible.length) : null,
    brierScore: round(average(eligible.map((record) => record.brier))),
    logLoss: round(average(eligible.map((record) => record.logLoss))),
    hitRate: eligible.length ? round(successes / eligible.length) : null,
    hitRateInterval: wilsonInterval(successes, eligible.length),
    stake: round(stakeTotal, 4),
    profit: round(profitTotal, 4),
    yield: stakeTotal > 0 ? round(profitTotal / stakeTotal) : null,
    maximumDrawdown: maximumDrawdown(eligible),
    promotionAllowed: false,
    promotionReason: status.promotionEligibleBySample
      ? "Metrics are evidence for human review only; automatic model promotion is disabled."
      : "Sample is below the configured threshold and automatic promotion is disabled."
  };
}

function buildSlices(observations, key, mapper, configuration) {
  const groups = new Map();
  for (const observation of observations) {
    const name = clean(mapper(observation), 160) || "unknown";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(observation);
  }
  return [...groups.entries()].map(([name, records]) => ({ key, name, ...summarizeGroup(records, configuration) }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

export function buildCalibrationReport(records = [], options = {}) {
  const generatedAt = iso(options.generatedAt) || new Date().toISOString();
  const observations = (Array.isArray(records) ? records : []).map(normalizeObservation);
  const configuration = { ...CALIBRATION_DEFAULTS, ...(options.configuration || {}) };
  const overall = summarizeGroup(observations, configuration);
  const exclusions = observations.reduce((counts, observation) => {
    if (observation.exclusionReason) counts[observation.exclusionReason] = (counts[observation.exclusionReason] || 0) + 1;
    else if (!observation.eligible) counts["incomplete-metric-input"] = (counts["incomplete-metric-input"] || 0) + 1;
    return counts;
  }, {});
  const eligible = observations.filter((observation) => observation.eligible);
  const slices = {
    sport: buildSlices(observations, "sport", (item) => item.sport, configuration),
    league: buildSlices(observations, "league", (item) => item.league, configuration),
    market: buildSlices(observations, "market", (item) => item.market, configuration),
    bookmaker: buildSlices(observations, "bookmaker", (item) => item.bookmaker, configuration),
    oddsRange: buildSlices(observations, "oddsRange", (item) => oddsBucket(item.entryOdds), configuration),
    decision: buildSlices(observations, "decision", (item) => item.decision, configuration),
    modelVersion: buildSlices(observations, "modelVersion", (item) => item.modelVersion, configuration)
  };
  const dates = eligible.map((item) => item.createdAt).filter(Boolean).sort();
  return {
    ok: true,
    version: CALIBRATION_LAB_VERSION,
    generatedAt,
    paperOnly: true,
    status: eligible.length ? "available" : "missing",
    methodology: {
      priceClv: "entry_decimal_odds * closing_no_vig_probability - 1",
      probabilityClv: "closing_no_vig_probability - entry_market_probability",
      binaryBrier: "(model_probability - outcome)^2",
      multiclassBrier: "sum((p_i - y_i)^2)",
      binaryLogLoss: "-[y ln(p) + (1-y) ln(1-p)] with bounded p",
      multiclassLogLoss: "-ln(p_observed_class) with bounded p",
      confidenceInterval: "Wilson score interval, 95%",
      closingEvidence: "final eligible provider observations captured before kickoff",
      currentOddsFallbackAllowed: false,
      simulatedClosingAllowed: false
    },
    window: {
      firstEntryAt: dates[0] || null,
      lastEntryAt: dates.at(-1) || null,
      generatedAt
    },
    received: observations.length,
    eligible: eligible.length,
    excluded: observations.length - eligible.length,
    exclusions,
    overall,
    calibrationBins: calibrationBins(observations, { binCount: configuration.calibrationBins }),
    slices,
    championChallenger: {
      automaticPromotion: false,
      comparisonAvailable: slices.modelVersion.filter((item) => item.count >= configuration.minimumSliceSample).length >= 2,
      minimumSliceSample: configuration.minimumSliceSample,
      note: "Model-version metrics support human review only. Scorecaster never promotes a challenger automatically."
    },
    records: options.includeRecords ? eligible.map((item) => ({
      betId: item.betId,
      eventId: item.eventId,
      sport: item.sport,
      league: item.league,
      market: item.market,
      selection: item.selection,
      bookmaker: item.bookmaker,
      decision: item.decision,
      modelVersion: item.modelVersion,
      entryOdds: item.entryOdds,
      entryMarketProbability: item.entryMarketProbability,
      modelProbability: item.modelProbability,
      closingConsensusProbability: item.closingConsensusProbability,
      closingFairOdds: item.closingFairOdds,
      closingProviderCount: item.closingProviderCount,
      outcomeValue: item.outcomeValue,
      stake: item.stake,
      profit: item.profit,
      priceClv: item.priceClv,
      probabilityClv: item.probabilityClv,
      brier: item.brier,
      logLoss: item.logLoss,
      createdAt: item.createdAt,
      kickoffAt: item.kickoffAt,
      closingCapturedAt: item.closingCapturedAt,
      settledAt: item.settledAt
    })) : undefined,
    exportBoundary: {
      personalIdentifiersIncluded: false,
      rawProviderPayloadIncluded: false,
      apiKeysIncluded: false
    },
    safety: {
      closingAvailableToPrematchDecision: false,
      currentOddsUsedAsClosingFallback: false,
      simulatedClosingUsed: false,
      automaticModelPromotion: false,
      realMoneyExecution: false
    }
  };
}
