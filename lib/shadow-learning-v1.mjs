import { buildSelfLearningReport } from "./agent-self-learning.mjs";

const DEFAULTS = Object.freeze({
  minimumSettledSamples: 300,
  minimumClvSamples: 100,
  minimumPositiveClvRate: 0.52,
  maximumDrawdownPercent: 20,
  holdoutFraction: 0.3,
  minimumBrierImprovement: 0.005
});

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 4) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function outcome(row = {}) {
  const value = String(row.result || row.outcome || row.settlement_status || "").toLowerCase();
  if (["win", "won"].includes(value)) return 1;
  if (["loss", "lost"].includes(value)) return 0;
  return null;
}

function timestamp(row = {}, index = 0) {
  const value = Date.parse(row.settled_at || row.settledAt || row.created_at || row.createdAt || "");
  return Number.isFinite(value) ? value : index;
}

function clvValue(row = {}) {
  const stored = finite(row.clv);
  if (stored !== null) return stored;
  const placed = finite(row.odds_at_selection ?? row.oddsAtSelection ?? row.odds);
  const closing = finite(row.closing_odds ?? row.closingOdds);
  return placed !== null && closing !== null && placed > 1 && closing > 1
    ? placed / closing - 1
    : null;
}

function profitValue(row = {}) {
  const stored = finite(row.profit);
  if (stored !== null) return stored;
  const stake = Math.max(0, finite(row.stake, 0));
  const odds = Math.max(1, finite(row.odds_at_selection ?? row.odds, 1));
  const resolved = outcome(row);
  if (resolved === 1) return stake * (odds - 1);
  if (resolved === 0) return -stake;
  return 0;
}

export function normalizeShadowLearningSamples(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const resolved = outcome(row);
      const probability = finite(
        row.original_probability ??
        row.originalProbability ??
        row.model_probability ??
        row.modelProbability
      );
      if (resolved === null || probability === null || probability <= 0 || probability >= 1) return null;
      const stake = Math.max(0, finite(row.stake, 0));
      const time = timestamp(row, index);
      return {
        id: String(row.id || row.bet_id || `shadow-${index}`),
        probability,
        outcome: resolved,
        result: resolved === 1 ? "win" : "loss",
        timestamp: time,
        createdAt: new Date(time).toISOString(),
        sportKey: String(row.sport || row.sport_key || "unknown"),
        marketKey: String(row.market || row.market_key || "unknown"),
        modelVersion: String(row.model_version || row.modelVersion || "unknown"),
        stake,
        odds: finite(row.odds_at_selection ?? row.oddsAtSelection ?? row.odds),
        closingOdds: finite(row.closing_odds ?? row.closingOdds),
        clv: clvValue(row),
        profit: profitValue(row)
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

function maximumDrawdown(samples = []) {
  let equity = 0;
  let peak = 0;
  let worst = 0;
  const base = Math.max(1, samples.reduce((sum, row) => sum + row.stake, 0));
  for (const row of samples) {
    equity += row.profit;
    peak = Math.max(peak, equity);
    worst = Math.max(worst, (peak - equity) / base);
  }
  return worst;
}

function segmentSummary(samples, key) {
  const groups = new Map();
  for (const sample of samples) {
    const name = String(sample[key] || "unknown");
    const entry = groups.get(name) || { key: name, sample: 0, stake: 0, profit: 0, clv: [] };
    entry.sample += 1;
    entry.stake += sample.stake;
    entry.profit += sample.profit;
    if (sample.clv !== null) entry.clv.push(sample.clv);
    groups.set(name, entry);
  }
  return [...groups.values()]
    .map((entry) => ({
      key: entry.key,
      sample: entry.sample,
      roi: entry.stake > 0 ? round(entry.profit / entry.stake, 4) : null,
      averageClv: entry.clv.length ? round(entry.clv.reduce((sum, value) => sum + value, 0) / entry.clv.length, 4) : null
    }))
    .sort((left, right) => right.sample - left.sample || left.key.localeCompare(right.key))
    .slice(0, 20);
}

export function buildShadowLearningCycle(rows = [], options = {}) {
  const config = {
    minimumSettledSamples: Math.trunc(clamp(options.minimumSettledSamples ?? DEFAULTS.minimumSettledSamples, 120, 5000)),
    minimumClvSamples: Math.trunc(clamp(options.minimumClvSamples ?? DEFAULTS.minimumClvSamples, 30, 5000)),
    minimumPositiveClvRate: clamp(options.minimumPositiveClvRate ?? DEFAULTS.minimumPositiveClvRate, 0.5, 0.9),
    maximumDrawdownPercent: clamp(options.maximumDrawdownPercent ?? DEFAULTS.maximumDrawdownPercent, 2, 50),
    holdoutFraction: clamp(options.holdoutFraction ?? DEFAULTS.holdoutFraction, 0.2, 0.5),
    minimumBrierImprovement: clamp(options.minimumBrierImprovement ?? DEFAULTS.minimumBrierImprovement, 0, 0.1)
  };
  const samples = normalizeShadowLearningSamples(rows);
  const learningRows = samples.map((sample) => ({
    id: sample.id,
    result: sample.result,
    createdAt: sample.createdAt,
    modelProbability: sample.probability,
    sportKey: sample.sportKey,
    marketKey: sample.marketKey
  }));
  const calibration = buildSelfLearningReport(learningRows, {
    minimumSamples: config.minimumSettledSamples,
    holdoutFraction: config.holdoutFraction,
    minimumBrierImprovement: config.minimumBrierImprovement
  });
  const clv = samples.map((sample) => sample.clv).filter((value) => value !== null && Number.isFinite(value));
  const stake = samples.reduce((sum, sample) => sum + sample.stake, 0);
  const profit = samples.reduce((sum, sample) => sum + sample.profit, 0);
  const averageClv = clv.length ? clv.reduce((sum, value) => sum + value, 0) / clv.length : null;
  const positiveClvRate = clv.length ? clv.filter((value) => value > 0).length / clv.length : null;
  const drawdown = maximumDrawdown(samples);
  const gates = {
    settledSample: samples.length >= config.minimumSettledSamples,
    clvSample: clv.length >= config.minimumClvSamples,
    positiveAverageClv: averageClv !== null && averageClv > 0,
    positiveClvRate: positiveClvRate !== null && positiveClvRate >= config.minimumPositiveClvRate,
    calibrationHoldout: calibration.promotion?.eligible === true,
    stableDrift: !["warning", "critical"].includes(calibration.drift?.status),
    riskWithinLimit: drawdown * 100 <= config.maximumDrawdownPercent
  };
  const reasons = [];
  if (!gates.settledSample) reasons.push(`Tarvitaan vähintään ${config.minimumSettledSamples} ratkaistua paperihavaintoa.`);
  if (!gates.clvSample) reasons.push(`Tarvitaan vähintään ${config.minimumClvSamples} closing-odds-havaintoa.`);
  if (gates.clvSample && !gates.positiveAverageClv) reasons.push("Keskimääräinen CLV ei ole positiivinen.");
  if (gates.clvSample && !gates.positiveClvRate) reasons.push(`Positiivisen CLV:n osuus jää alle ${(config.minimumPositiveClvRate * 100).toFixed(0)} prosentin.`);
  if (gates.settledSample && !gates.calibrationHoldout) reasons.push("Haastajamalli ei läpäissyt kronologista kalibrointi-holdoutia.");
  if (!gates.stableDrift) reasons.push("Datadrift estää mallin hyväksyntäehdotuksen.");
  if (!gates.riskWithinLimit) reasons.push(`Paperitulosten drawdown ylittää ${config.maximumDrawdownPercent.toFixed(1)} prosenttia.`);
  const reviewReady = Object.values(gates).every(Boolean);
  const status = calibration.drift?.status === "critical"
    ? "frozen-drift"
    : !gates.settledSample || !gates.clvSample
      ? "collecting-evidence"
      : reviewReady
        ? "challenger-review-ready"
        : "challenger-rejected";

  return {
    version: "shadow-learning-v1",
    mode: "shadow-only",
    status,
    generatedAt: new Date().toISOString(),
    sampleSize: samples.length,
    clvSample: clv.length,
    metrics: {
      stake: round(stake, 2),
      profit: round(profit, 2),
      roi: stake > 0 ? round(profit / stake, 4) : null,
      averageClv: round(averageClv, 4),
      positiveClvRate: round(positiveClvRate, 4),
      maximumDrawdown: round(drawdown, 4)
    },
    calibration,
    segments: {
      sports: segmentSummary(samples, "sportKey"),
      markets: segmentSummary(samples, "marketKey"),
      models: segmentSummary(samples, "modelVersion")
    },
    promotion: {
      reviewReady,
      automaticPromotionAllowed: false,
      reasons: reviewReady
        ? ["Haastaja täyttää tutkimusportit, mutta vaatii erillisen ihmisen hyväksynnän ja versionoidun tuotantotestin."]
        : reasons
    },
    gates,
    thresholds: config,
    safety: {
      chronologicalHoldout: true,
      originalProbabilityImmutable: true,
      productionProbabilityChanged: false,
      contextCanUpgradeToPlay: false,
      automaticRealMoneyExecution: false,
      paperOnly: true
    }
  };
}

export const SHADOW_LEARNING_DEFAULTS = DEFAULTS;
