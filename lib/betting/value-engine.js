// lib/betting/value-engine.js

const DEFAULTS = {
  minOdds: 1.01,
  maxOdds: 1000,
  maxKellyFraction: 0.25, // quarter Kelly cap safety
  minModelProbability: 0.0001,
  maxModelProbability: 0.9999,
  minEdgeToBet: 0.015, // 1.5 %
  minEvToBet: 0.01, // 1 %
};

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function round(value, decimals = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sanitizeOdds(decimalOdds, config = {}) {
  const minOdds = config.minOdds ?? DEFAULTS.minOdds;
  const maxOdds = config.maxOdds ?? DEFAULTS.maxOdds;

  const odds = toNumber(decimalOdds);
  if (!Number.isFinite(odds)) return null;
  if (odds < minOdds || odds > maxOdds) return null;

  return odds;
}

function sanitizeProbability(probability, config = {}) {
  const min = config.minModelProbability ?? DEFAULTS.minModelProbability;
  const max = config.maxModelProbability ?? DEFAULTS.maxModelProbability;

  const p = toNumber(probability);
  if (!Number.isFinite(p)) return null;

  return clamp(p, min, max);
}

/**
 * Raw implied probability from decimal odds.
 * Example: odds 2.00 => 0.50
 */
function impliedProbabilityFromOdds(decimalOdds) {
  const odds = sanitizeOdds(decimalOdds);
  if (!odds) return null;
  return 1 / odds;
}

/**
 * Remove bookmaker margin by normalizing all outcomes in the same market.
 * Example:
 * 1X2 odds [2.10, 3.40, 3.10]
 */
function normalizeImpliedProbabilities(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) return [];

  const raw = outcomes.map((outcome) => {
    const odds = sanitizeOdds(outcome?.odds);
    if (!odds) return null;

    return {
      ...outcome,
      odds,
      rawImpliedProbability: 1 / odds,
    };
  });

  const valid = raw.filter(Boolean);
  if (valid.length === 0) return [];

  const total = valid.reduce((sum, item) => sum + item.rawImpliedProbability, 0);
  if (!Number.isFinite(total) || total <= 0) return [];

  return valid.map((item) => ({
    ...item,
    marketProbability: item.rawImpliedProbability / total,
  }));
}

/**
 * Expected value using decimal odds.
 * EV = p * odds - 1
 * Example: p=0.55, odds=2.10 => 0.155 => 15.5%
 */
function expectedValue(modelProbability, decimalOdds) {
  const p = sanitizeProbability(modelProbability);
  const odds = sanitizeOdds(decimalOdds);

  if (!p || !odds) return null;

  return p * odds - 1;
}

/**
 * Kelly fraction using decimal odds.
 * b = odds - 1
 * q = 1 - p
 * Kelly = ((b * p) - q) / b
 */
function kellyFraction(modelProbability, decimalOdds, config = {}) {
  const p = sanitizeProbability(modelProbability, config);
  const odds = sanitizeOdds(decimalOdds, config);

  if (!p || !odds) return 0;

  const b = odds - 1;
  if (b <= 0) return 0;

  const q = 1 - p;
  const fullKelly = ((b * p) - q) / b;

  if (!Number.isFinite(fullKelly) || fullKelly <= 0) return 0;

  const capped = Math.min(fullKelly, config.maxKellyFraction ?? DEFAULTS.maxKellyFraction);
  return capped;
}

function fairOddsFromProbability(modelProbability) {
  const p = sanitizeProbability(modelProbability);
  if (!p) return null;
  return 1 / p;
}

function edge(modelProbability, marketProbability) {
  const mp = sanitizeProbability(modelProbability);
  const mk = sanitizeProbability(marketProbability);

  if (!mp || !mk) return null;

  return mp - mk;
}

function getNoBetReasons({ edgeValue, evValue, modelProbability, marketProbability, odds }, config = {}) {
  const reasons = [];

  if (!sanitizeOdds(odds, config)) reasons.push("invalid_odds");
  if (!sanitizeProbability(modelProbability, config)) reasons.push("invalid_model_probability");
  if (!sanitizeProbability(marketProbability, config)) reasons.push("invalid_market_probability");

  if (sanitizeProbability(modelProbability, config) && sanitizeProbability(marketProbability, config)) {
    if ((edgeValue ?? -999) < (config.minEdgeToBet ?? DEFAULTS.minEdgeToBet)) {
      reasons.push("edge_too_small");
    }
  }

  if ((evValue ?? -999) < (config.minEvToBet ?? DEFAULTS.minEvToBet)) {
    reasons.push("ev_too_small");
  }

  return reasons;
}

/**
 * Builds one value bet row safely.
 */
function createValueBet({
  match,
  marketKey,
  outcomeName,
  bookmaker,
  odds,
  modelProbability,
  marketProbability,
  extra = {},
  config = {},
}) {
  const cleanOdds = sanitizeOdds(odds, config);
  const cleanModelProbability = sanitizeProbability(modelProbability, config);
  const cleanMarketProbability = sanitizeProbability(marketProbability, config);

  const fairOdds = cleanModelProbability ? fairOddsFromProbability(cleanModelProbability) : null;
  const edgeValue =
    cleanModelProbability && cleanMarketProbability
      ? edge(cleanModelProbability, cleanMarketProbability)
      : null;
  const evValue =
    cleanModelProbability && cleanOdds
      ? expectedValue(cleanModelProbability, cleanOdds)
      : null;
  const kellyValue =
    cleanModelProbability && cleanOdds
      ? kellyFraction(cleanModelProbability, cleanOdds, config)
      : 0;

  const noBetReasons = getNoBetReasons(
    {
      edgeValue,
      evValue,
      modelProbability: cleanModelProbability,
      marketProbability: cleanMarketProbability,
      odds: cleanOdds,
    },
    config
  );

  const isBet = noBetReasons.length === 0;

  return {
    match: match ?? null,
    marketKey: marketKey ?? null,
    outcomeName: outcomeName ?? null,
    bookmaker: bookmaker ?? null,

    odds: cleanOdds,
    fairOdds: fairOdds ? round(fairOdds, 3) : null,

    modelProbability: cleanModelProbability ? round(cleanModelProbability, 4) : null,
    marketProbability: cleanMarketProbability ? round(cleanMarketProbability, 4) : null,

    edge: edgeValue !== null ? round(edgeValue, 4) : null,
    ev: evValue !== null ? round(evValue, 4) : null,
    kelly: kellyValue !== null ? round(kellyValue, 4) : 0,

    isBet,
    noBetReasons,

    ...extra,
  };
}

/**
 * Public function:
 * - takes one market's outcomes
 * - normalizes market implied probabilities
 * - matches each outcome to model probability
 * - returns sorted value bets
 */
function buildValueBets({
  match,
  marketKey,
  bookmaker,
  outcomes,
  modelProbabilitiesByOutcome,
  config = {},
}) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) return [];

  const normalizedOutcomes = normalizeImpliedProbabilities(outcomes);
  if (normalizedOutcomes.length === 0) return [];

  const result = normalizedOutcomes.map((outcome) => {
    const modelProbability = modelProbabilitiesByOutcome?.[outcome.name];

    return createValueBet({
      match,
      marketKey,
      outcomeName: outcome.name,
      bookmaker,
      odds: outcome.odds,
      marketProbability: outcome.marketProbability,
      modelProbability,
      config,
    });
  });

  return result.sort((a, b) => {
    const aScore = (a.isBet ? 1 : 0) * 1000 + (a.ev ?? -999) * 100 + (a.edge ?? -999);
    const bScore = (b.isBet ? 1 : 0) * 1000 + (b.ev ?? -999) * 100 + (b.edge ?? -999);
    return bScore - aScore;
  });
}

module.exports = {
  DEFAULTS,
  clamp,
  round,
  sanitizeOdds,
  sanitizeProbability,
  impliedProbabilityFromOdds,
  normalizeImpliedProbabilities,
  expectedValue,
  kellyFraction,
  fairOddsFromProbability,
  edge,
  createValueBet,
  buildValueBets,
};
