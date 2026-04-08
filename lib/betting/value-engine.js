// lib/betting/value-engine.js

export const VALUE_ENGINE_DEFAULTS = {
  minOdds: 1.01,
  maxOdds: 1000,
  minProbability: 0.0001,
  maxProbability: 0.9999,
  minEdgeToBet: 0.015, // 1.5%
  minEvToBet: 0.01, // 1%
  maxKellyFraction: 0.25, // quarter Kelly cap
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

export function sanitizeOdds(decimalOdds, config = {}) {
  const minOdds = config.minOdds ?? VALUE_ENGINE_DEFAULTS.minOdds;
  const maxOdds = config.maxOdds ?? VALUE_ENGINE_DEFAULTS.maxOdds;

  const odds = toNumber(decimalOdds);
  if (!Number.isFinite(odds)) return null;
  if (odds < minOdds || odds > maxOdds) return null;

  return odds;
}

export function sanitizeProbability(probability, config = {}) {
  const min = config.minProbability ?? VALUE_ENGINE_DEFAULTS.minProbability;
  const max = config.maxProbability ?? VALUE_ENGINE_DEFAULTS.maxProbability;

  const p = toNumber(probability);
  if (!Number.isFinite(p)) return null;

  return clamp(p, min, max);
}

export function impliedProbabilityFromOdds(decimalOdds, config = {}) {
  const odds = sanitizeOdds(decimalOdds, config);
  if (!odds) return null;
  return 1 / odds;
}

export function fairOddsFromProbability(modelProbability, config = {}) {
  const p = sanitizeProbability(modelProbability, config);
  if (!p) return null;
  return 1 / p;
}

export function expectedValue(modelProbability, decimalOdds, config = {}) {
  const p = sanitizeProbability(modelProbability, config);
  const odds = sanitizeOdds(decimalOdds, config);

  if (!p || !odds) return null;

  // EV = p * odds - 1
  return p * odds - 1;
}

export function edge(modelProbability, marketProbability, config = {}) {
  const mp = sanitizeProbability(modelProbability, config);
  const mk = sanitizeProbability(marketProbability, config);

  if (!mp || !mk) return null;

  return mp - mk;
}

export function kellyFraction(modelProbability, decimalOdds, config = {}) {
  const p = sanitizeProbability(modelProbability, config);
  const odds = sanitizeOdds(decimalOdds, config);

  if (!p || !odds) return 0;

  const b = odds - 1;
  if (b <= 0) return 0;

  const q = 1 - p;
  const fullKelly = ((b * p) - q) / b;

  if (!Number.isFinite(fullKelly) || fullKelly <= 0) return 0;

  return Math.min(
    fullKelly,
    config.maxKellyFraction ?? VALUE_ENGINE_DEFAULTS.maxKellyFraction
  );
}

export function normalizeImpliedProbabilities(outcomes, config = {}) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) return [];

  const valid = outcomes
    .map((outcome) => {
      const odds = sanitizeOdds(outcome?.price ?? outcome?.odds, config);
      if (!odds) return null;

      return {
        ...outcome,
        odds,
        rawImpliedProbability: 1 / odds,
      };
    })
    .filter(Boolean);

  if (valid.length === 0) return [];

  const total = valid.reduce(
    (sum, item) => sum + item.rawImpliedProbability,
    0
  );

  if (!Number.isFinite(total) || total <= 0) return [];

  return valid.map((item) => ({
    ...item,
    marketProbability: item.rawImpliedProbability / total,
  }));
}

function buildNoBetReasons({
  odds,
  modelProbability,
  marketProbability,
  edgeValue,
  evValue,
  config,
}) {
  const reasons = [];

  if (!sanitizeOdds(odds, config)) reasons.push("invalid_odds");
  if (!sanitizeProbability(modelProbability, config)) {
    reasons.push("invalid_model_probability");
  }
  if (!sanitizeProbability(marketProbability, config)) {
    reasons.push("invalid_market_probability");
  }

  const minEdgeToBet = config.minEdgeToBet ?? VALUE_ENGINE_DEFAULTS.minEdgeToBet;
  const minEvToBet = config.minEvToBet ?? VALUE_ENGINE_DEFAULTS.minEvToBet;

  if (typeof edgeValue === "number" && edgeValue < minEdgeToBet) {
    reasons.push("edge_too_small");
  }

  if (typeof evValue === "number" && evValue < minEvToBet) {
    reasons.push("ev_too_small");
  }

  return reasons;
}

function buildStatus({ isBet }) {
  return isBet ? "bet" : "no_bet";
}

export function createValueBet({
  matchLabel,
  marketKey,
  outcomeName,
  bookmaker,
  odds,
  modelProbability,
  marketProbability,
  bankroll = 0,
  config = {},
}) {
  const cleanOdds = sanitizeOdds(odds, config);
  const cleanModelProbability = sanitizeProbability(modelProbability, config);
  const cleanMarketProbability = sanitizeProbability(marketProbability, config);

  const fairOdds = cleanModelProbability
    ? fairOddsFromProbability(cleanModelProbability, config)
    : null;

  const edgeValue =
    cleanModelProbability && cleanMarketProbability
      ? edge(cleanModelProbability, cleanMarketProbability, config)
      : null;

  const evValue =
    cleanModelProbability && cleanOdds
      ? expectedValue(cleanModelProbability, cleanOdds, config)
      : null;

  const kellyValue =
    cleanModelProbability && cleanOdds
      ? kellyFraction(cleanModelProbability, cleanOdds, config)
      : 0;

  const noBetReasons = buildNoBetReasons({
    odds: cleanOdds,
    modelProbability: cleanModelProbability,
    marketProbability: cleanMarketProbability,
    edgeValue,
    evValue,
    config,
  });

  const isBet = noBetReasons.length === 0;
  const recommendedStake =
    bankroll && kellyValue ? round(bankroll * kellyValue, 2) : 0;

  return {
    match: matchLabel ?? null,
    marketKey: marketKey ?? null,
    outcomeName: outcomeName ?? null,
    bookmaker: bookmaker ?? null,

    odds: cleanOdds ? round(cleanOdds, 2) : null,
    fairOdds: fairOdds ? round(fairOdds, 3) : null,

    modelProbability:
      cleanModelProbability !== null ? round(cleanModelProbability, 4) : null,
    marketProbability:
      cleanMarketProbability !== null ? round(cleanMarketProbability, 4) : null,

    edge: edgeValue !== null ? round(edgeValue, 4) : null,
    ev: evValue !== null ? round(evValue, 4) : null,
    kelly: kellyValue !== null ? round(kellyValue, 4) : 0,

    recommendedStake,
    isBet,
    status: buildStatus({ isBet }),
    noBetReasons,
  };
}

export function buildValueBets({
  matchLabel,
  marketKey,
  bookmaker,
  outcomes,
  modelProbabilitiesByOutcome,
  bankroll = 0,
  config = {},
}) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) return [];

  const normalized = normalizeImpliedProbabilities(outcomes, config);
  if (normalized.length === 0) return [];

  const bets = normalized.map((outcome) => {
    const outcomeName = outcome?.name ?? null;
    const modelProbability = modelProbabilitiesByOutcome?.[outcomeName];

    return createValueBet({
      matchLabel,
      marketKey,
      outcomeName,
      bookmaker,
      odds: outcome.odds,
      modelProbability,
      marketProbability: outcome.marketProbability,
      bankroll,
      config,
    });
  });

  return bets.sort((a, b) => {
    const aScore = (a.isBet ? 1000 : 0) + (a.ev ?? -999) * 100 + (a.edge ?? -999);
    const bScore = (b.isBet ? 1000 : 0) + (b.ev ?? -999) * 100 + (b.edge ?? -999);
    return bScore - aScore;
  });
}
