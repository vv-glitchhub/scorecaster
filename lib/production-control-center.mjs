import { buildDecisionTransparency } from "./decision-transparency.mjs";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const latest = (rows, metric) => [...rows]
  .filter((row) => row.metric === metric && Number.isFinite(Number(row.value)))
  .sort((a, b) => new Date(b.observedAt || b.observed_at || 0) - new Date(a.observedAt || a.observed_at || 0))[0] || null;
const ageHours = (row, now = Date.now()) => row
  ? Math.max(0, (now - new Date(row.observedAt || row.observed_at || row.collectedAt || row.collected_at || 0).getTime()) / 36e5)
  : Infinity;
const eventId = (row) => row.eventId || row.event_id;
const sourceId = (row) => row.sourceId || row.source_id;

export function calibrationMetrics(samples = []) {
  const settled = samples.filter((sample) => [0, 1].includes(Number(sample.result)) && Number.isFinite(Number(sample.probability)));
  if (!settled.length) return { count: 0, brier: null, logLoss: null, calibrationError: null, grade: "N/A", buckets: [] };

  let brier = 0;
  let logLoss = 0;
  const buckets = new Map();

  for (const sample of settled) {
    const probability = clamp(sample.probability, 0.001, 0.999);
    const result = Number(sample.result);
    brier += (probability - result) ** 2;
    logLoss += -(result * Math.log(probability) + (1 - result) * Math.log(1 - probability));
    const key = Math.min(9, Math.floor(probability * 10));
    const bucket = buckets.get(key) || { from: key / 10, to: (key + 1) / 10, count: 0, predicted: 0, actual: 0 };
    bucket.count += 1;
    bucket.predicted += probability;
    bucket.actual += result;
    buckets.set(key, bucket);
  }

  const output = [...buckets.values()].map((bucket) => ({
    ...bucket,
    predicted: Number((bucket.predicted / bucket.count).toFixed(4)),
    actual: Number((bucket.actual / bucket.count).toFixed(4)),
    gap: Number(Math.abs(bucket.predicted / bucket.count - bucket.actual / bucket.count).toFixed(4))
  }));
  const calibrationError = output.reduce((sum, bucket) => sum + bucket.gap * bucket.count, 0) / settled.length;
  const brierScore = brier / settled.length;
  const grade = settled.length < 100
    ? "D"
    : brierScore <= 0.18 && calibrationError <= 0.05
      ? "A"
      : brierScore <= 0.21 && calibrationError <= 0.08
        ? "B"
        : brierScore <= 0.24 && calibrationError <= 0.12
          ? "C"
          : "D";

  return {
    count: settled.length,
    brier: Number(brierScore.toFixed(5)),
    logLoss: Number((logLoss / settled.length).toFixed(5)),
    calibrationError: Number(calibrationError.toFixed(5)),
    grade,
    buckets: output
  };
}

export function closingLineReport(records = []) {
  const byEvent = new Map();
  for (const record of records) {
    const id = eventId(record);
    if (!id) continue;
    const rows = byEvent.get(id) || [];
    rows.push(record);
    byEvent.set(id, rows);
  }

  const events = [];
  for (const [id, rows] of byEvent) {
    const prices = rows
      .filter((row) => row.metric === "best_odds" && Number(row.value) > 1)
      .sort((a, b) => new Date(a.observedAt || a.observed_at) - new Date(b.observedAt || b.observed_at));
    if (prices.length < 2) continue;
    const openingOdds = num(prices[0].value);
    const closingOdds = num(prices.at(-1).value);
    events.push({
      eventId: id,
      openingOdds,
      closingOdds,
      priceClv: Number((openingOdds / closingOdds - 1).toFixed(4)),
      observations: prices.length
    });
  }

  return {
    count: events.length,
    averagePriceClv: events.length ? Number((events.reduce((sum, event) => sum + event.priceClv, 0) / events.length).toFixed(4)) : null,
    events: events.sort((a, b) => Math.abs(b.priceClv) - Math.abs(a.priceClv)).slice(0, 100)
  };
}

export function rankDailyTop3(records = [], now = Date.now()) {
  const byEvent = new Map();
  for (const record of records) {
    const id = eventId(record);
    if (!id) continue;
    const rows = byEvent.get(id) || [];
    rows.push(record);
    byEvent.set(id, rows);
  }

  const picks = [];
  for (const [id, rows] of byEvent) {
    const market = latest(rows, "market_probability") || latest(rows, "implied_probability");
    const model = latest(rows, "model_probability") || latest(rows, "expected_probability") || latest(rows, "win_probability");
    const odds = latest(rows, "best_odds") || latest(rows, "decimal_odds");
    const marketProbability = market
      ? clamp(market.value)
      : odds && num(odds.value) > 1
        ? clamp(1 / num(odds.value))
        : null;
    const modelProbability = model ? clamp(model.value) : null;

    // A card may still be shown as CAUTION or SKIP when only market data exists.
    // This prevents an apparently broken empty home page while keeping positive-edge claims gated.
    if (marketProbability === null && modelProbability === null) continue;

    const newest = [...rows].sort((a, b) => new Date(b.observedAt || b.observed_at || 0) - new Date(a.observedAt || a.observed_at || 0))[0];
    const trust = rows.reduce((sum, row) => sum + num(row.sourceTrust ?? row.source_trust), 0) / Math.max(1, rows.length);
    const confidence = rows.reduce((sum, row) => sum + num(row.confidence), 0) / Math.max(1, rows.length);
    const sources = new Set(rows.map(sourceId).filter(Boolean)).size;
    const freshness = Math.max(0, 1 - Math.min(1, ageHours(newest, now) / 24));
    const recordCoverage = Math.min(1, rows.length / 8);
    const sourceDiversity = Math.min(1, sources / 2);
    const quality = 0.30 * trust + 0.25 * confidence + 0.20 * freshness + 0.15 * recordCoverage + 0.10 * sourceDiversity;
    const edge = modelProbability !== null && marketProbability !== null ? modelProbability - marketProbability : null;
    const edgeContribution = edge === null ? 0 : Math.min(0.15, Math.abs(edge)) / 0.15;
    const score = 100 * (quality * 0.70 + edgeContribution * 0.30);

    const decision = quality < 0.55
      ? "SKIP"
      : edge !== null && edge >= 0.04 && quality >= 0.72
        ? "WATCH"
        : "CAUTION";

    const missing = [];
    if (modelProbability === null) missing.push("model_probability");
    if (marketProbability === null) missing.push("market_probability_or_odds");
    if (!odds || num(odds.value) <= 1) missing.push("best_odds");
    if (sources < 2) missing.push("second_source");

    const pick = {
      eventId: id,
      score: Number(score.toFixed(1)),
      decision,
      modelProbability: modelProbability === null ? null : Number(modelProbability.toFixed(4)),
      marketProbability: marketProbability === null ? null : Number(marketProbability.toFixed(4)),
      edge: edge === null ? null : Number(edge.toFixed(4)),
      bestOdds: odds ? num(odds.value) : null,
      quality: Number(quality.toFixed(4)),
      sources,
      records: rows.length,
      missing,
      reason: decision === "WATCH"
        ? "Positive paper edge with sufficient data quality"
        : decision === "CAUTION"
          ? modelProbability === null
            ? "Market observation is visible, but an independent model probability is missing"
            : "Evidence is usable, but one or more WATCH gates did not pass"
          : "Evidence is incomplete, stale or below the minimum quality gate"
    };

    picks.push({ ...pick, explanation: buildDecisionTransparency(rows, pick, now) });
  }

  return picks.sort((a, b) => b.score - a.score).slice(0, 3);
}

export function modelComparison(records = []) {
  const models = [
    ["market_probability", "Market consensus"],
    ["model_probability", "Scorecaster model"],
    ["simulation_probability", "Scenario simulation"]
  ];

  return models.map(([metric, name]) => {
    const rows = records.filter((row) => row.metric === metric && Number.isFinite(Number(row.value)));
    const events = new Set(rows.map(eventId).filter(Boolean)).size;
    const confidence = rows.length ? rows.reduce((sum, row) => sum + num(row.confidence), 0) / rows.length : 0;
    const trust = rows.length ? rows.reduce((sum, row) => sum + num(row.sourceTrust ?? row.source_trust), 0) / rows.length : 0;
    const score = 100 * (0.45 * Math.min(1, events / 20) + 0.30 * confidence + 0.25 * trust);
    return {
      metric,
      name,
      observations: rows.length,
      events,
      confidence: Number(confidence.toFixed(4)),
      trust: Number(trust.toFixed(4)),
      score: Number(score.toFixed(1)),
      grade: score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score > 0 ? "D" : "N/A"
    };
  });
}

export function buildProductionControlCenter({ records = [], settledSamples = [], collectorHealth = null, now = Date.now() } = {}) {
  const top3 = rankDailyTop3(records, now);
  const calibration = calibrationMetrics(settledSamples);
  const closingLine = closingLineReport(records);
  const models = modelComparison(records);
  const events = new Set(records.map(eventId).filter(Boolean)).size;
  const sources = new Set(records.map(sourceId).filter(Boolean)).size;
  const latestRow = [...records].sort((a, b) => new Date(b.observedAt || b.observed_at || 0) - new Date(a.observedAt || a.observed_at || 0))[0];
  const freshness = latestRow ? ageHours(latestRow, now) : Infinity;

  const blockers = [];
  if (!records.length) blockers.push("no-publishable-records");
  if (freshness > 2) blockers.push("collector-stale");
  if (events < 3) blockers.push("insufficient-event-coverage");
  if (sources < 1) blockers.push("no-active-source");
  if (calibration.count < 300) blockers.push("calibration-sample-below-300");
  if (!closingLine.count) blockers.push("closing-line-history-missing");
  if (collectorHealth && collectorHealth.status !== "healthy") blockers.push(`collector-${collectorHealth.status}`);

  return {
    version: "scorecaster-production-control-center-v2",
    generatedAt: new Date(now).toISOString(),
    readiness: {
      status: blockers.length ? "blocked" : "ready",
      score: Number((100 - Math.min(100, blockers.length * 14)).toFixed(0)),
      blockers
    },
    summary: {
      records: records.length,
      events,
      sources,
      freshnessHours: Number.isFinite(freshness) ? Number(freshness.toFixed(2)) : null,
      visibleDailyCards: top3.length,
      watchCards: top3.filter((pick) => pick.decision === "WATCH").length,
      cautionCards: top3.filter((pick) => pick.decision === "CAUTION").length,
      skipCards: top3.filter((pick) => pick.decision === "SKIP").length
    },
    dailyTop3: top3,
    calibration,
    closingLine,
    models,
    safety: {
      paperOnly: true,
      productionProbabilityChanged: false,
      automaticBetting: false,
      playUpgradeAllowed: false,
      researchDataExcluded: true,
      explanationsDoNotChangeDecisions: true
    }
  };
}
