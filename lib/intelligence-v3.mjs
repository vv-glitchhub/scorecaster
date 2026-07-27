import { createHash } from "node:crypto";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const clean = (value, limit = 180) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);

function seeded(seed) {
  let state = Number.parseInt(createHash("sha256").update(String(seed)).digest("hex").slice(0, 8), 16) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function latestMetric(records, metric) {
  return [...records].filter((row) => row.metric === metric).sort((a, b) => new Date(b.observedAt) - new Date(a.observedAt))[0] || null;
}

function metricValue(records, names, fallback = null) {
  for (const name of names) {
    const row = latestMetric(records, name);
    if (row && Number.isFinite(Number(row.value))) return Number(row.value);
    const payloadValue = row?.payload?.value;
    if (Number.isFinite(Number(payloadValue))) return Number(payloadValue);
  }
  return fallback;
}

function profile(records, entityId = null) {
  const rows = entityId ? records.filter((row) => row.entityId === entityId) : records;
  const confidence = mean(rows.map((row) => Number(row.confidence)).filter(Number.isFinite)) ?? 0;
  const trust = mean(rows.map((row) => Number(row.sourceTrust)).filter(Number.isFinite)) ?? 0;
  const metrics = new Set(rows.map((row) => row.metric));
  const freshnessHours = rows.length ? Math.max(0, (Date.now() - Math.max(...rows.map((row) => new Date(row.observedAt).getTime()))) / 3600000) : null;
  const coverage = clamp(metrics.size / 12);
  const freshness = freshnessHours === null ? 0 : freshnessHours <= 2 ? 1 : freshnessHours <= 12 ? 0.8 : freshnessHours <= 48 ? 0.55 : 0.25;
  const score = Math.round(100 * (0.3 * trust + 0.25 * confidence + 0.25 * coverage + 0.2 * freshness));
  return { score, trust: clamp(trust), confidence: clamp(confidence), coverage, freshnessHours, metrics: [...metrics].sort(), recordCount: rows.length };
}

export function buildScout(records = [], context = {}) {
  const market = clamp(metricValue(records, ["market_probability", "implied_probability"], 0.5), 0.01, 0.99);
  const expected = metricValue(records, ["expected_probability", "model_probability", "win_probability"], null);
  const quality = profile(records);
  const edge = expected === null ? null : expected - market;
  const factors = [
    { id: "market", label: "Market consensus", value: market, impact: 0, available: true },
    { id: "model", label: "Model probability", value: expected, impact: edge, available: expected !== null },
    { id: "trust", label: "Source trust", value: quality.trust, impact: (quality.trust - 0.7) * 0.08, available: records.length > 0 },
    { id: "confidence", label: "Data confidence", value: quality.confidence, impact: (quality.confidence - 0.7) * 0.08, available: records.length > 0 },
    { id: "coverage", label: "Metric coverage", value: quality.coverage, impact: (quality.coverage - 0.5) * 0.05, available: records.length > 0 }
  ];
  const completenessPenalty = clamp((1 - quality.coverage) * 0.08, 0, 0.08);
  const intelligenceScore = Math.round(100 * clamp((expected ?? market) + factors.reduce((sum, factor) => sum + (factor.impact || 0), 0) - completenessPenalty));
  const risk = quality.score < 45 ? "high" : quality.score < 70 ? "medium" : "low";
  return { version: "ai-scout-v3", eventId: clean(context.eventId), intelligenceScore, marketProbability: market, modelProbability: expected, edge, dataQuality: quality, risk, factors, missing: factors.filter((factor) => !factor.available).map((factor) => factor.id), probabilityChanged: false };
}

export function simulateScenarios(records = [], options = {}) {
  const iterations = Math.max(1000, Math.min(100000, Number(options.iterations) || 20000));
  const scout = buildScout(records, options);
  const base = clamp(scout.modelProbability ?? scout.marketProbability, 0.02, 0.98);
  const volatility = clamp(Number(options.volatility) || (scout.risk === "high" ? 0.16 : scout.risk === "medium" ? 0.11 : 0.07), 0.02, 0.3);
  const rng = seeded(`${options.eventId || "event"}:${iterations}:${base}:${volatility}`);
  let wins = 0;
  const buckets = Array.from({ length: 10 }, (_, index) => ({ from: index / 10, to: (index + 1) / 10, count: 0 }));
  for (let index = 0; index < iterations; index += 1) {
    const scenarioProbability = clamp(base + (rng() + rng() + rng() - 1.5) * volatility, 0.01, 0.99);
    if (rng() < scenarioProbability) wins += 1;
    buckets[Math.min(9, Math.floor(scenarioProbability * 10))].count += 1;
  }
  return { version: "scenario-simulator-v3", iterations, baseProbability: base, simulatedProbability: wins / iterations, volatility, distribution: buckets.map((bucket) => ({ ...bucket, share: bucket.count / iterations })), deterministicSeed: true, paperOnly: true };
}

export function buildDna(records = []) {
  const entities = [...new Set(records.map((row) => row.entityId).filter(Boolean))];
  const players = entities.map((entityId) => ({ entityId, ...profile(records, entityId) })).sort((a, b) => b.score - a.score).slice(0, 50);
  const team = profile(records);
  return {
    version: "dna-v3",
    team: { ...team, attack: clamp(metricValue(records, ["attack_rating", "offense_rating", "xg_for"], team.score / 100)), defense: clamp(metricValue(records, ["defense_rating", "xg_against_prevention"], team.score / 100)), tempo: metricValue(records, ["pace", "tempo"], null), fatigue: metricValue(records, ["fatigue", "rest_disadvantage"], null) },
    players,
    limitations: players.length ? [] : ["No entity-attributed player observations available"]
  };
}

export function runBettingLab(records = [], options = {}) {
  const scout = buildScout(records, options);
  const odds = metricValue(records, ["best_odds", "decimal_odds"], null);
  const probability = scout.modelProbability ?? scout.marketProbability;
  const edge = odds ? probability - 1 / odds : null;
  const fullKelly = odds && edge !== null ? clamp((odds * probability - 1) / (odds - 1), 0, 0.05) : 0;
  const strategies = [
    { id: "flat", name: "Flat paper stake", stakeFraction: edge !== null && edge > 0.02 ? 0.01 : 0 },
    { id: "quarter-kelly", name: "Quarter Kelly", stakeFraction: fullKelly * 0.25 },
    { id: "half-kelly", name: "Half Kelly", stakeFraction: fullKelly * 0.5 },
    { id: "full-kelly-capped", name: "Full Kelly capped", stakeFraction: fullKelly }
  ].map((strategy) => ({ ...strategy, expectedReturn: odds ? strategy.stakeFraction * (probability * odds - 1) : null, allowed: scout.risk !== "high" && strategy.stakeFraction > 0 }));
  return { version: "betting-lab-v3", odds, probability, edge, strategies, recommendation: strategies.filter((item) => item.allowed).sort((a, b) => (b.expectedReturn || 0) - (a.expectedReturn || 0))[0] || null, paperOnly: true, realMoneyExecution: false };
}

export function coachExplanation(records = [], options = {}) {
  const scout = buildScout(records, options);
  const simulator = simulateScenarios(records, { ...options, iterations: Math.min(10000, Number(options.iterations) || 5000) });
  const lab = runBettingLab(records, options);
  const reasons = scout.factors.filter((factor) => factor.available).sort((a, b) => Math.abs(b.impact || 0) - Math.abs(a.impact || 0)).slice(0, 5);
  return {
    version: "ai-coach-v3",
    verdict: scout.risk === "high" ? "SKIP" : lab.edge !== null && lab.edge > 0.04 ? "CAUTION" : "WATCH",
    summary: scout.risk === "high" ? "Data quality is too weak for a confident paper decision." : lab.edge !== null && lab.edge > 0 ? "Available evidence suggests a positive paper edge, but uncertainty remains." : "The market and available model evidence are close.",
    reasons,
    missing: scout.missing,
    simulatedProbability: simulator.simulatedProbability,
    dataQualityScore: scout.dataQuality.score,
    transparency: { recordsUsed: records.length, metricsUsed: scout.dataQuality.metrics, inventedData: false, productionProbabilityChanged: false }
  };
}

export function buildIntelligenceBundle(records = [], options = {}) {
  return { generatedAt: new Date().toISOString(), eventId: clean(options.eventId), scout: buildScout(records, options), simulator: simulateScenarios(records, options), dna: buildDna(records), bettingLab: runBettingLab(records, options), coach: coachExplanation(records, options), safety: { paperOnly: true, realMoneyExecution: false, researchDataExcluded: true, productionProbabilityChanged: false } };
}
