function safeNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, decimals = 4) {
  const n = safeNumber(value, null);
  if (n == null) return null;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeImpliedProbabilities(outcomes = []) {
  const withImplied = outcomes
    .map((outcome) => {
      const odds = safeNumber(outcome?.odds ?? outcome?.price, null);
      if (odds == null || odds <= 1) return null;

      return {
        ...outcome,
        odds,
        implied: 1 / odds,
      };
    })
    .filter(Boolean);

  const total = withImplied.reduce((sum, item) => sum + item.implied, 0);

  if (!total || total <= 0) {
    return withImplied.map((item) => ({
      ...item,
      marketProbability: null,
    }));
  }

  return withImplied.map((item) => ({
    ...item,
    marketProbability: item.implied / total,
  }));
}

function getLevel(edge, ev) {
  if (edge > 0.05 && ev > 0.03) return "strong";
  if (edge > 0.015 && ev > 0) return "playable";
  return "skip";
}

function getConfidence(modelProbability, marketProbability, edge, ev, kelly) {
  const p = safeNumber(modelProbability, 0);
  const mp = safeNumber(marketProbability, 0);
  const e = Math.max(0, safeNumber(edge, 0));
  const expectedValue = Math.max(0, safeNumber(ev, 0));
  const k = Math.max(0, safeNumber(kelly, 0));

  const score =
    e * 700 +
    expectedValue * 300 +
    p * 35 +
    Math.max(0, p - mp) * 80 +
    k * 100;

  return Math.round(clamp(score, 0, 99));
}

function getKelly(modelProbability, odds, maxKellyFraction = 0.25) {
  const p = safeNumber(modelProbability, null);
  const o = safeNumber(odds, null);
  if (p == null || o == null || o <= 1) return 0;

  const b = o - 1;
  const q = 1 - p;
  const fullKelly = ((b * p) - q) / b;

  if (!Number.isFinite(fullKelly) || fullKelly <= 0) return 0;
  return Math.min(fullKelly, maxKellyFraction);
}

function getReasonTag(level, edge, ev) {
  if (level === "strong") return "Strong edge + EV";
  if (level === "playable") return "Playable value";
  if (safeNumber(edge, 0) <= 0) return "No edge";
  if (safeNumber(ev, 0) <= 0) return "Negative EV";
  return "No clear value";
}

function getRankScore(bet) {
  return (
    safeNumber(bet?.confidence, 0) * 10 +
    safeNumber(bet?.edge, 0) * 1000 +
    safeNumber(bet?.ev, 0) * 700 +
    safeNumber(bet?.kelly, 0) * 200 +
    (bet?.level === "strong" ? 1000 : bet?.level === "playable" ? 300 : 0)
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
  const normalized = normalizeImpliedProbabilities(outcomes);

  return normalized.map((outcome) => {
    const outcomeName = String(outcome?.name ?? "").trim() || "Unknown";
    const odds = safeNumber(outcome?.odds ?? outcome?.price, null);
    const marketProbability = safeNumber(outcome?.marketProbability, null);
    const modelProbability = safeNumber(
      modelProbabilitiesByOutcome?.[outcomeName],
      null
    );

    const fairOdds =
      modelProbability && modelProbability > 0 ? 1 / modelProbability : null;

    const edge =
      modelProbability != null && marketProbability != null
        ? modelProbability - marketProbability
        : null;

    const ev =
      modelProbability != null && odds != null
        ? modelProbability * odds - 1
        : null;

    const kelly = getKelly(
      modelProbability,
      odds,
      safeNumber(config?.maxKellyFraction, 0.25)
    );

    const recommendedStake = round(safeNumber(bankroll, 0) * kelly, 2) ?? 0;
    const level = getLevel(safeNumber(edge, 0), safeNumber(ev, 0));
    const confidence = getConfidence(
      modelProbability,
      marketProbability,
      edge,
      ev,
      kelly
    );

    return {
      matchLabel,
      marketKey,
      bookmaker: bookmaker ?? "Unknown",
      outcome: outcomeName,
      outcomeName,
      odds: round(odds, 2),
      fairOdds: round(fairOdds, 2),
      modelProb: round(modelProbability, 4),
      modelProbability: round(modelProbability, 4),
      marketProb: round(marketProbability, 4),
      marketProbability: round(marketProbability, 4),
      edge: round(edge, 4),
      ev: round(ev, 4),
      kelly: round(kelly, 4),
      stake: round(recommendedStake, 2),
      recommendedStake: round(recommendedStake, 2),
      confidence,
      level,
      reasonTag: getReasonTag(level, edge, ev),
      isBet: level !== "skip",
    };
  });
}

export function rankValueBets(valueBets = []) {
  return [...valueBets].sort((a, b) => getRankScore(b) - getRankScore(a));
}

export function summarizeValueBets(valueBets = []) {
  const total = valueBets.length;
  const playable = valueBets.filter((bet) => bet.level !== "skip");

  return {
    total,
    playable: playable.length,
    skipped: total - playable.length,
    averageEdge:
      playable.length > 0
        ? round(
            playable.reduce((sum, bet) => sum + safeNumber(bet.edge, 0), 0) /
              playable.length,
            4
          )
        : 0,
    averageEv:
      playable.length > 0
        ? round(
            playable.reduce((sum, bet) => sum + safeNumber(bet.ev, 0), 0) /
              playable.length,
            4
          )
        : 0,
  };
}
