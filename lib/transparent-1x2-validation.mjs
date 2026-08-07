export const TRANSPARENT_1X2_VALIDATION_VERSION = "scorecaster-transparent-1x2-validation-v2";

const CLASSES = Object.freeze(["home", "draw", "away"]);
const DEFAULT_BIN_COUNT = 10;
const EPSILON = 1e-9;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
const clean = (value, maximum = 120) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

function probabilities(value) {
  if (!value || typeof value !== "object") return null;
  const parsed = Object.fromEntries(CLASSES.map((key) => [key, Number(value[key])]));
  if (CLASSES.some((key) => !Number.isFinite(parsed[key]) || parsed[key] <= 0 || parsed[key] >= 1)) return null;
  const total = CLASSES.reduce((sum, key) => sum + parsed[key], 0);
  if (Math.abs(total - 1) > 0.01) return null;
  return Object.fromEntries(CLASSES.map((key) => [key, parsed[key] / total]));
}

function normalizeRecord(input = {}, index = 0) {
  const predictedAt = iso(input.predictedAt ?? input.generatedAt ?? input.createdAt);
  const kickoffAt = iso(input.kickoffAt ?? input.commenceTime ?? input.commence_time);
  const trainingCutoff = iso(input.trainingCutoff ?? input.training_cutoff);
  const prediction = probabilities(input.probabilities ?? input.modelProbabilities ?? input.prediction);
  const market = probabilities(input.marketProbabilities ?? input.marketBenchmark?.probabilities);
  const outcome = clean(input.outcome ?? input.result, 12).toLowerCase();
  const reasons = [];

  if (!prediction) reasons.push("invalid-model-probabilities");
  if (!CLASSES.includes(outcome)) reasons.push("invalid-outcome");
  if (!predictedAt) reasons.push("missing-prediction-time");
  if (!kickoffAt) reasons.push("missing-kickoff-time");
  if (predictedAt && kickoffAt && Date.parse(predictedAt) >= Date.parse(kickoffAt)) reasons.push("prediction-not-prestart");
  if (trainingCutoff && predictedAt && Date.parse(trainingCutoff) > Date.parse(predictedAt)) reasons.push("training-cutoff-after-prediction");

  return {
    ok: reasons.length === 0,
    reasons,
    record: reasons.length ? null : {
      id: clean(input.id ?? input.eventId ?? `row-${index}`, 160),
      predictedAt,
      kickoffAt,
      trainingCutoff,
      probabilities: prediction,
      marketProbabilities: market,
      outcome,
      league: clean(input.league, 120) || "unknown",
      season: clean(input.season, 80) || "unknown",
      market: clean(input.market, 60) || "h2h",
      provider: clean(input.provider ?? input.bookmaker, 100) || "unknown",
      decisionClass: clean(input.decisionClass ?? input.decision, 40).toUpperCase() || "UNKNOWN",
      modelVersion: clean(input.modelVersion, 120) || "unknown"
    }
  };
}

function outcomeVector(outcome) {
  return Object.fromEntries(CLASSES.map((key) => [key, key === outcome ? 1 : 0]));
}

function scoreRows(rows, probabilityKey = "probabilities") {
  const eligible = rows.filter((row) => row[probabilityKey]);
  let brierSum = 0;
  let logLossSum = 0;
  for (const row of eligible) {
    const actual = outcomeVector(row.outcome);
    brierSum += CLASSES.reduce((sum, key) => sum + ((row[probabilityKey][key] - actual[key]) ** 2), 0) / CLASSES.length;
    logLossSum += -Math.log(clamp(row[probabilityKey][row.outcome], EPSILON, 1 - EPSILON));
  }
  return {
    samples: eligible.length,
    brierNumerator: round(brierSum),
    brierDenominator: eligible.length,
    brier: eligible.length ? round(brierSum / eligible.length) : null,
    logLossNumerator: round(logLossSum),
    logLossDenominator: eligible.length,
    logLoss: eligible.length ? round(logLossSum / eligible.length) : null
  };
}

function reliabilityBins(rows, binCount = DEFAULT_BIN_COUNT) {
  const count = Math.max(5, Math.min(20, Math.trunc(Number(binCount) || DEFAULT_BIN_COUNT)));
  const bins = Array.from({ length: count }, (_, index) => ({
    index,
    lower: index / count,
    upper: (index + 1) / count,
    observations: 0,
    probabilitySum: 0,
    outcomeSum: 0
  }));

  for (const row of rows) {
    for (const key of CLASSES) {
      const probability = row.probabilities[key];
      const index = Math.min(count - 1, Math.floor(probability * count));
      const bin = bins[index];
      bin.observations += 1;
      bin.probabilitySum += probability;
      bin.outcomeSum += row.outcome === key ? 1 : 0;
    }
  }

  return bins.map((bin) => {
    const meanPrediction = bin.observations ? bin.probabilitySum / bin.observations : null;
    const empiricalRate = bin.observations ? bin.outcomeSum / bin.observations : null;
    return {
      index: bin.index,
      lower: round(bin.lower, 3),
      upper: round(bin.upper, 3),
      observations: bin.observations,
      meanPrediction: round(meanPrediction),
      empiricalRate: round(empiricalRate),
      calibrationGap: meanPrediction === null || empiricalRate === null ? null : round(empiricalRate - meanPrediction)
    };
  });
}

function classBalance(rows) {
  return Object.fromEntries(CLASSES.map((key) => {
    const count = rows.filter((row) => row.outcome === key).length;
    return [key, { count, share: rows.length ? round(count / rows.length) : 0 }];
  }));
}

function groupedMetrics(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = clean(row[key], 120) || "unknown";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups.entries()]
    .map(([value, group]) => ({ value, ...scoreRows(group), classBalance: classBalance(group) }))
    .sort((left, right) => right.samples - left.samples || left.value.localeCompare(right.value));
}

function chronologicalFolds(rows, options = {}) {
  const minimumTrain = Math.max(1, Math.trunc(Number(options.minimumTrain) || 50));
  const testWindow = Math.max(1, Math.trunc(Number(options.testWindow) || 25));
  const ordered = [...rows].sort((left, right) => Date.parse(left.kickoffAt) - Date.parse(right.kickoffAt));
  const folds = [];

  for (let start = minimumTrain; start < ordered.length; start += testWindow) {
    const test = ordered.slice(start, Math.min(ordered.length, start + testWindow));
    const train = ordered.slice(0, start);
    if (!test.length) continue;
    const testStart = test[0].kickoffAt;
    const trainingChronologySafe = train.every((row) => Date.parse(row.kickoffAt) < Date.parse(testStart));
    folds.push({
      fold: folds.length + 1,
      trainingRows: train.length,
      testRows: test.length,
      trainingEndAt: train.at(-1)?.kickoffAt || null,
      testStartAt: testStart,
      testEndAt: test.at(-1)?.kickoffAt || null,
      trainingChronologySafe,
      metrics: scoreRows(test),
      marketBenchmark: scoreRows(test, "marketProbabilities")
    });
  }
  return folds;
}

function exclusionSummary(rejections = []) {
  const counts = {};
  for (const item of rejections) {
    for (const reason of item.reasons) counts[reason] = (counts[reason] || 0) + 1;
  }
  return Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)).map(([reason, count]) => ({ reason, count }));
}

export function evaluateTransparent1X2Backtest(records = [], options = {}) {
  const normalized = (Array.isArray(records) ? records : []).map((row, index) => normalizeRecord(row, index));
  const eligible = normalized.filter((item) => item.ok).map((item) => item.record);
  const rejected = normalized.filter((item) => !item.ok);
  const minimumSample = Math.max(10, Math.trunc(Number(options.minimumSample) || 100));
  const model = scoreRows(eligible);
  const benchmark = scoreRows(eligible, "marketProbabilities");
  const folds = chronologicalFolds(eligible, options);

  return {
    ok: true,
    version: TRANSPARENT_1X2_VALIDATION_VERSION,
    generatedAt: iso(options.generatedAt) || new Date().toISOString(),
    receivedRows: normalized.length,
    eligibleRows: eligible.length,
    excludedRows: rejected.length,
    exclusions: exclusionSummary(rejected),
    model,
    marketBenchmark: benchmark,
    deltaVsMarket: {
      brier: model.brier !== null && benchmark.brier !== null ? round(model.brier - benchmark.brier) : null,
      logLoss: model.logLoss !== null && benchmark.logLoss !== null ? round(model.logLoss - benchmark.logLoss) : null,
      interpretation: "negative means the model scored better than the available no-vig market benchmark"
    },
    calibration: {
      binCount: Math.max(5, Math.min(20, Math.trunc(Number(options.binCount) || DEFAULT_BIN_COUNT))),
      bins: reliabilityBins(eligible, options.binCount)
    },
    classBalance: classBalance(eligible),
    slices: {
      league: groupedMetrics(eligible, "league"),
      season: groupedMetrics(eligible, "season"),
      market: groupedMetrics(eligible, "market"),
      provider: groupedMetrics(eligible, "provider"),
      decisionClass: groupedMetrics(eligible, "decisionClass"),
      modelVersion: groupedMetrics(eligible, "modelVersion")
    },
    chronologicalFolds: folds,
    sampleAssessment: {
      minimumSample,
      sufficient: eligible.length >= minimumSample,
      label: eligible.length >= minimumSample ? "adequate-for-descriptive-evaluation" : "small-sample-do-not-promote"
    },
    formulas: {
      multiclassBrier: "mean((p_home-y_home)^2 + (p_draw-y_draw)^2 + (p_away-y_away)^2) / 3",
      logLoss: "mean(-ln(p_actual_outcome)) with probability bounded away from 0 and 1",
      calibrationGap: "empirical outcome frequency - mean predicted probability within each bin"
    },
    leakageBoundary: {
      predictionsAtOrAfterKickoffExcluded: true,
      trainingCutoffAfterPredictionExcluded: true,
      closingLineUsedAsModelInput: false,
      marketBenchmarkScoredSeparately: true
    },
    automaticPromotionAllowed: false,
    personalDataIncluded: false,
    restrictedProviderPayloadIncluded: false,
    paperOnly: true
  };
}
