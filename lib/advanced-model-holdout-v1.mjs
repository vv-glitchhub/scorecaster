export const ADVANCED_MODEL_HOLDOUT_VERSION = "scorecaster-advanced-model-holdout-v1";

const MIN_PROVISIONAL_SAMPLE = 30;
const MIN_REVIEW_SAMPLE = 100;
const CALIBRATION_BINS = 10;

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 6) {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value) {
  const parsed = timestamp(value);
  return parsed === null ? null : new Date(parsed).toISOString();
}

function clean(value, limit = 180) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeName(value = "") {
  return String(value).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function namesMatch(left, right) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function average(values = []) {
  const rows = values.filter((value) => Number.isFinite(value));
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
}

function clampProbability(value) {
  const parsed = finite(value);
  if (parsed === null || parsed <= 0 || parsed >= 1) return null;
  return Math.max(1e-6, Math.min(1 - 1e-6, parsed));
}

function binaryBrier(probability, outcome) {
  const p = clampProbability(probability);
  if (p === null || ![0, 1].includes(outcome)) return null;
  return (p - outcome) ** 2;
}

function binaryLogLoss(probability, outcome) {
  const p = clampProbability(probability);
  if (p === null || ![0, 1].includes(outcome)) return null;
  return -(outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p));
}

function multiclassBrier(probabilities, outcomeIndex) {
  if (!Array.isArray(probabilities) || probabilities.length < 2) return null;
  if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0 || outcomeIndex >= probabilities.length) return null;
  const values = probabilities.map(finite);
  if (values.some((value) => value === null || value < 0 || value > 1)) return null;
  return values.reduce((sum, probability, index) => sum + (probability - (index === outcomeIndex ? 1 : 0)) ** 2, 0);
}

function multiclassLogLoss(probabilities, outcomeIndex) {
  if (!Array.isArray(probabilities) || probabilities.length < 2) return null;
  if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0 || outcomeIndex >= probabilities.length) return null;
  const probability = clampProbability(probabilities[outcomeIndex]);
  return probability === null ? null : -Math.log(probability);
}

function calibrationGap(rows, classKey) {
  let weighted = 0;
  let total = 0;
  for (let bin = 0; bin < CALIBRATION_BINS; bin += 1) {
    const lower = bin / CALIBRATION_BINS;
    const upper = (bin + 1) / CALIBRATION_BINS;
    const values = rows.filter((row) => {
      const probability = finite(row.probabilities?.[classKey]);
      return probability !== null && probability >= lower && (bin === CALIBRATION_BINS - 1 ? probability <= upper : probability < upper);
    });
    if (!values.length) continue;
    const predicted = average(values.map((row) => finite(row.probabilities?.[classKey])));
    const observed = average(values.map((row) => row.outcomeClass === classKey ? 1 : 0));
    weighted += values.length * Math.abs(predicted - observed);
    total += values.length;
  }
  return total ? weighted / total : null;
}

function resultTime(result = {}) {
  const date = clean(result.date, 20);
  const time = clean(result.time, 20) || "00:00:00";
  return timestamp(`${date}T${time}`) ?? timestamp(date);
}

function matchResult(prediction, results = []) {
  const commence = timestamp(prediction.commenceTime);
  const candidates = results.filter((result) => result?.is_finished !== false)
    .filter((result) => namesMatch(prediction.homeTeam, result.home_team) && namesMatch(prediction.awayTeam, result.away_team))
    .map((result) => ({ result, time: resultTime(result) }))
    .filter((item) => item.time === null || commence === null || Math.abs(item.time - commence) <= 7 * 24 * 60 * 60 * 1000)
    .sort((left, right) => {
      if (commence === null) return (right.time || 0) - (left.time || 0);
      return Math.abs((left.time || commence) - commence) - Math.abs((right.time || commence) - commence);
    });
  return candidates[0]?.result || null;
}

function normalizeSnapshotPredictions(snapshotRows = []) {
  const candidates = [];
  for (const snapshot of Array.isArray(snapshotRows) ? snapshotRows : []) {
    const capturedAt = iso(snapshot.captured_at ?? snapshot.capturedAt);
    const commenceTime = iso(snapshot.commence_time ?? snapshot.commenceTime);
    const capturedTime = timestamp(capturedAt);
    const commence = timestamp(commenceTime);
    if (!capturedAt || !commenceTime || capturedTime > commence) continue;
    const summary = snapshot.raw_summary && typeof snapshot.raw_summary === "object" ? snapshot.raw_summary : snapshot.rawSummary || {};
    for (const model of Array.isArray(summary.shadowModels) ? summary.shadowModels : []) {
      const modelVersion = clean(model.modelVersion || model.version, 160);
      const modelId = clean(model.modelId, 160);
      const inputSnapshotHash = clean(model.inputSnapshotHash, 128);
      const predictionHorizon = iso(model.predictionHorizon);
      if (!modelVersion || !modelId || !inputSnapshotHash || !predictionHorizon) continue;
      if (timestamp(predictionHorizon) > commence) continue;
      candidates.push({
        eventId: clean(snapshot.event_id ?? snapshot.eventId, 180),
        sportKey: clean(snapshot.sport_key ?? snapshot.sportKey, 120),
        sport: clean(model.sport || snapshot.canonical_sport, 80),
        league: clean(snapshot.league, 140),
        commenceTime,
        capturedAt,
        modelId,
        modelVersion,
        family: clean(model.family, 100),
        inputSnapshotHash,
        homeTeam: clean(model.homeTeam, 140),
        awayTeam: clean(model.awayTeam, 140),
        probabilities: model.probabilities && typeof model.probabilities === "object" ? model.probabilities : {},
        providers: Array.isArray(model.providers) ? model.providers.slice(0, 10) : [],
        metrics: Array.isArray(model.metrics) ? model.metrics.slice(0, 30) : []
      });
    }
  }

  const latest = new Map();
  for (const prediction of candidates) {
    const identity = `${prediction.eventId}|${prediction.modelVersion}`;
    const current = latest.get(identity);
    if (!current || timestamp(prediction.capturedAt) > timestamp(current.capturedAt)) latest.set(identity, prediction);
  }
  return [...latest.values()];
}

function evaluatePrediction(prediction, result) {
  const homeScore = finite(result?.home_score);
  const awayScore = finite(result?.away_score);
  if (homeScore === null || awayScore === null) return null;

  if (prediction.sport === "soccer") {
    const probabilities = [finite(prediction.probabilities.home), finite(prediction.probabilities.draw), finite(prediction.probabilities.away)];
    if (probabilities.some((value) => value === null)) return null;
    const outcomeIndex = homeScore > awayScore ? 0 : homeScore === awayScore ? 1 : 2;
    const outcomeClass = outcomeIndex === 0 ? "home" : outcomeIndex === 1 ? "draw" : "away";
    return {
      ...prediction,
      outcomeClass,
      result: { homeScore, awayScore },
      brier: multiclassBrier(probabilities, outcomeIndex),
      logLoss: multiclassLogLoss(probabilities, outcomeIndex)
    };
  }

  if (prediction.sport === "ice_hockey") {
    if (homeScore === awayScore) return null;
    const homeProbability = finite(prediction.probabilities.home);
    if (homeProbability === null) return null;
    const outcome = homeScore > awayScore ? 1 : 0;
    return {
      ...prediction,
      outcomeClass: outcome ? "home" : "away",
      result: { homeScore, awayScore },
      brier: binaryBrier(homeProbability, outcome),
      logLoss: binaryLogLoss(homeProbability, outcome)
    };
  }

  return null;
}

function summarizeModel(modelRows, now) {
  const sport = modelRows[0]?.sport || "unknown";
  const classes = sport === "soccer" ? ["home", "draw", "away"] : ["home"];
  const gaps = classes.map((classKey) => calibrationGap(modelRows, classKey)).filter((value) => value !== null);
  const sampleSize = modelRows.length;
  const status = sampleSize >= MIN_REVIEW_SAMPLE ? "review-ready" : sampleSize >= MIN_PROVISIONAL_SAMPLE ? "research" : "insufficient";
  const commenceTimes = modelRows.map((row) => row.commenceTime).filter(Boolean).sort();
  const result = {
    modelId: modelRows[0]?.modelId || null,
    modelVersion: modelRows[0]?.modelVersion || null,
    family: modelRows[0]?.family || null,
    sport,
    sampleSize,
    status,
    brier: round(average(modelRows.map((row) => row.brier))),
    logLoss: round(average(modelRows.map((row) => row.logLoss))),
    calibrationGap: round(average(gaps)),
    testStart: commenceTimes[0] || null,
    testEnd: commenceTimes.at(-1) || null,
    evaluatedAt: new Date(now).toISOString(),
    providerSet: [...new Set(modelRows.flatMap((row) => row.providers || []))].sort(),
    metricSet: [...new Set(modelRows.flatMap((row) => row.metrics || []))].sort(),
    reviewEligibleBySample: sampleSize >= MIN_REVIEW_SAMPLE,
    ensembleWeightAvailable: false,
    automaticPromotionAllowed: false
  };
  return {
    ...result,
    performanceEvidenceDraft: {
      modelId: result.modelId,
      modelVersion: result.modelVersion,
      status,
      evaluationMode: "chronological-holdout",
      sampleSize,
      performanceWeight: null,
      weightSource: null,
      evaluatedAt: result.evaluatedAt,
      trainingCutoff: null,
      testStart: result.testStart,
      testEnd: result.testEnd,
      brier: result.brier,
      logLoss: result.logLoss,
      calibrationGap: result.calibrationGap,
      preEventOnly: true,
      closingLineLeakage: false,
      postEventDataUsed: false,
      scope: { sport, league: "mixed", market: sport === "soccer" ? "1x2" : "h2h" }
    }
  };
}

export function buildAdvancedModelHoldoutV1(snapshotRows = [], resultRows = [], { now = Date.now() } = {}) {
  const predictions = normalizeSnapshotPredictions(snapshotRows);
  const evaluated = [];
  const unmatched = [];
  for (const prediction of predictions) {
    const result = matchResult(prediction, resultRows);
    if (!result) {
      unmatched.push({ eventId: prediction.eventId, modelVersion: prediction.modelVersion, reason: "result-not-found" });
      continue;
    }
    const row = evaluatePrediction(prediction, result);
    if (row) evaluated.push(row);
    else unmatched.push({ eventId: prediction.eventId, modelVersion: prediction.modelVersion, reason: "result-or-probability-invalid" });
  }

  const groups = new Map();
  for (const row of evaluated) {
    if (!groups.has(row.modelVersion)) groups.set(row.modelVersion, []);
    groups.get(row.modelVersion).push(row);
  }
  const models = [...groups.values()].map((rows) => summarizeModel(rows, now)).sort((a, b) => b.sampleSize - a.sampleSize);

  return {
    ok: true,
    version: ADVANCED_MODEL_HOLDOUT_VERSION,
    generatedAt: new Date(now).toISOString(),
    counts: {
      snapshotRows: Array.isArray(snapshotRows) ? snapshotRows.length : 0,
      immutablePregamePredictions: predictions.length,
      settledEvaluations: evaluated.length,
      unmatchedPredictions: unmatched.length,
      models: models.length
    },
    models,
    unmatched: unmatched.slice(0, 100),
    contracts: {
      latestPregameCapturePerEventModel: true,
      postStartPredictionAccepted: false,
      inputSnapshotHashRequired: true,
      performanceWeightInvented: false,
      automaticPromotionAllowed: false,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      paperOnly: true
    }
  };
}

export const ADVANCED_MODEL_HOLDOUT_MIN_PROVISIONAL_SAMPLE = MIN_PROVISIONAL_SAMPLE;
export const ADVANCED_MODEL_HOLDOUT_MIN_REVIEW_SAMPLE = MIN_REVIEW_SAMPLE;
