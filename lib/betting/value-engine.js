export const VALUE_ENGINE_DEFAULTS = {
  minOdds: 1.01,
  maxOdds: 1000,
  minProbability: 0.0001,
  maxProbability: 0.9999,
  minEdgeToBet: 0.005,
  minEvToBet: 0.005,
  maxKellyFraction: 0.25,
};

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

export function fairOddsFromProbability(modelProbability, config = {}) {
  const p = sanitizeProbability(modelProbability, config);
  if (!p) return null;
  return 1 / p;
}

export function expectedValue(modelProbability, decimalOdds, config = {}) {
  const p = sanitizeProbability(modelProbability, config);
  const odds = sanitizeOdds(decimalOdds, config);

  if (!p || !odds) return null;
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

  const total = valid.reduce((sum, item) => sum + item.rawImpliedProbability, 0);
  if (!Number.isFinite(total) || total <= 0) return [];

  return valid.map((item) => ({
    ...item,
    marketProbability: item.rawImpliedProbability / total,
  }));
}

function getEdgeBucket(edgeValue) {
  if (!Number.isFinite(edgeValue)) return "unknown";
  if (edgeValue >= 0.08) return "elite";
  if (edgeValue >= 0.05) return "strong";
  if (edgeValue >= 0.025) return "solid";
  if (edgeValue >= 0.01) return "thin";
  if (edgeValue >= 0) return "marginal";
  return "negative";
}

function getEvBucket(evValue) {
  if (!Number.isFinite(evValue)) return "unknown";
  if (evValue >= 0.12) return "elite";
  if (evValue >= 0.08) return "strong";
  if (evValue >= 0.04) return "solid";
  if (evValue >= 0.01) return "thin";
  if (evValue >= 0) return "marginal";
  return "negative";
}

function getKellyBucket(kellyValue) {
  if (!Number.isFinite(kellyValue) || kellyValue <= 0) return "none";
  if (kellyValue >= 0.08) return "aggressive";
  if (kellyValue >= 0.04) return "medium";
  if (kellyValue >= 0.015) return "small";
  return "tiny";
}

function getConfidence(edgeValue, evValue, kellyValue, isBet) {
  if (
    !Number.isFinite(edgeValue) ||
    !Number.isFinite(evValue) ||
    !Number.isFinite(kellyValue)
  ) {
    return 0;
  }

  const edgeScore = Math.max(0, edgeValue * 700);
  const evScore = Math.max(0, evValue * 450);
  const kellyScore = Math.max(0, kellyValue * 300);
  const betBonus = isBet ? 15 : 0;

  return Math.min(
    100,
    Math.max(0, Math.round(edgeScore + evScore + kellyScore + betBonus))
  );
}

function getGrade(edgeValue, evValue, confidence, isBet) {
  if (!isBet) return "F";
  if (edgeValue >= 0.08 && evValue >= 0.08 && confidence >= 80) return "A";
  if (edgeValue >= 0.05 && evValue >= 0.05 && confidence >= 65) return "B";
  if (edgeValue >= 0.025 && evValue >= 0.025 && confidence >= 45) return "C";
  if (edgeValue > 0 && evValue > 0) return "D";
  return "F";
}

function getReasonTag({ edgeValue, evValue, kellyValue, confidence, isBet }) {
  if (!isBet) return "No bet";
  if (confidence >= 85 && edgeValue >= 0.08) return "Top tier edge";
  if (evValue >= 0.1) return "High EV";
  if (kellyValue >= 0.05) return "Strong stake";
  if (edgeValue >= 0.03) return "Playable edge";
  return "Thin value";
}

function buildNoBetReasons({
  odds,
  modelProbability,
  marketProbability,
  edgeValue,
  evValue,
  kellyValue,
  config,
}) {
  const reasons = [];

  if (!sanitizeOdds(odds, config)) reasons.push("invalid_odds");
  if (!sanitizeProbability(modelProbability, config)) reasons.push("invalid_model_probability");
  if (!sanitizeProbability(marketProbability, config)) reasons.push("invalid_market_probability");

  const minEdgeToBet = config.minEdgeToBet ?? VALUE_ENGINE_DEFAULTS.minEdgeToBet;
  const minEvToBet = config.minEvToBet ?? VALUE_ENGINE_DEFAULTS.minEvToBet;

  if (Number.isFinite(edgeValue) && edgeValue < 0) reasons.push("negative_edge");
  if (Number.isFinite(evValue) && evValue < 0) reasons.push("negative_ev");
  if (Number.isFinite(edgeValue) && edgeValue < minEdgeToBet) reasons.push("edge_too_small");
  if (Number.isFinite(evValue) && evValue < minEvToBet) reasons.push("ev_too_small");
  if (Number.isFinite(kellyValue) && kellyValue <= 0) reasons.push("kelly_zero");

  return reasons;
}

function getMarketSignal({ edgeValue, evValue, fairOdds, odds }) {
  if (!Number.isFinite(edgeValue) || !Number.isFinite(evValue)) return "unknown";
  if (Number.isFinite(fairOdds) && Number.isFinite(odds) && odds > fairOdds && edgeValue > 0.05) {
    return "market_underpricing";
  }
  if (edgeValue > 0.025 && evValue > 0.025) return "model_edge";
  if (edgeValue < 0 && evValue < 0) return "market_expensive";
  return "neutral";
}

function getClvPlaceholder(odds, fairOdds) {
  if (!Number.isFinite(odds) || !Number.isFinite(fairOdds)) return null;
  return {
    openingOdds: round(odds, 2),
    currentOdds: round(odds, 2),
    targetCloseOdds: round(fairOdds, 2),
    estimatedClvEdge: round(odds - fairOdds, 3),
  };
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
  const cleanOutcomeName = String(outcomeName ?? "").trim();

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
    kellyValue,
    config,
  });

  const isBet = noBetReasons.length === 0;
  const recommendedStake =
    bankroll && kellyValue ? round(bankroll * kellyValue, 2) : 0;

  const confidence = getConfidence(
    edgeValue ?? 0,
    evValue ?? 0,
    kellyValue ?? 0,
    isBet
  );

  const grade = getGrade(edgeValue ?? 0, evValue ?? 0, confidence, isBet);
  const reasonTag = getReasonTag({
    edgeValue: edgeValue ?? 0,
    evValue: evValue ?? 0,
    kellyValue: kellyValue ?? 0,
    confidence,
    isBet,
  });

  return {
    match: matchLabel ?? null,
    marketKey: marketKey ?? null,
    outcomeName: cleanOutcomeName || "Unknown",
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
    status: isBet ? "bet" : "no_bet",
    noBetReasons,
    confidence,
    grade,
    reasonTag,
    edgeBucket: getEdgeBucket(edgeValue),
    evBucket: getEvBucket(evValue),
    kellyBucket: getKellyBucket(kellyValue),
    marketSignal: getMarketSignal({
      edgeValue,
      evValue,
      fairOdds,
      odds: cleanOdds,
    }),
    clv: getClvPlaceholder(cleanOdds, fairOdds),
  };
}

function getRankScore(bet) {
  return (
    (bet.isBet ? 1000 : 0) +
    (bet.confidence ?? 0) * 10 +
    (bet.ev ?? -999) * 140 +
    (bet.edge ?? -999) * 180 +
    (bet.kelly ?? 0) * 50
  );
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
    const outcomeName = String(outcome?.name ?? "").trim();

    const modelProbability =
      modelProbabilitiesByOutcome?.[outcomeName] ??
      modelProbabilitiesByOutcome?.[outcomeName.toLowerCase?.()] ??
      null;

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

  return bets.sort((a, b) => getRankScore(b) - getRankScore(a));
}

export function summarizeValueBets(valueBets = []) {
  const bets = Array.isArray(valueBets) ? valueBets : [];
  const playable = bets.filter((bet) => bet.isBet);
  const best = playable[0] ?? bets[0] ?? null;

  return {
    total: bets.length,
    playableCount: playable.length,
    noBetCount: bets.length - playable.length,
    bestGrade: best?.grade ?? null,
    bestReasonTag: best?.reasonTag ?? null,
    averageEdge: playable.length
      ? round(
          playable.reduce((sum, bet) => sum + Number(bet.edge ?? 0), 0) /
            playable.length,
          4
        )
      : 0,
    averageEv: playable.length
      ? round(
          playable.reduce((sum, bet) => sum + Number(bet.ev ?? 0), 0) /
            playable.length,
          4
        )
      : 0,
  };
}
