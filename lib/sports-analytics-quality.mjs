const DEFAULT_LIMITS = Object.freeze({
  probability: [0, 1],
  "score-0-1": [0, 1],
  "score-0-100": [0, 100],
  "decimal-odds": [1.001, 1000],
  count: [0, 1000000],
  m: [0, 10000],
  "km/h": [0, 500],
  mph: [0, 320],
  seconds: [0, 86400],
  boolean: [0, 1]
});

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clean(value, limit = 160) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function standardDeviation(values, mean) {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

export function validateSportsAnalyticsObservation(observation = {}, { now = Date.now(), futureToleranceMinutes = 10 } = {}) {
  const errors = [];
  const warnings = [];
  const value = finite(observation.value);
  const observedAt = timestamp(observation.observedAt || observation.observed_at);
  const capturedAt = timestamp(observation.capturedAt || observation.captured_at);
  const unit = clean(observation.unit, 40);

  if (!clean(observation.eventId || observation.event_id, 180)) errors.push("event-id-missing");
  if (!clean(observation.metric, 120)) errors.push("metric-missing");
  if (!clean(observation.provider, 80)) errors.push("provider-missing");
  if (value === null) errors.push("value-invalid");
  if (observedAt === null) errors.push("observed-at-invalid");
  if (capturedAt === null) warnings.push("captured-at-invalid");
  if (observedAt !== null && observedAt > now + futureToleranceMinutes * 60_000) errors.push("observed-at-in-future");
  if (observedAt !== null && capturedAt !== null && observedAt > capturedAt + futureToleranceMinutes * 60_000) warnings.push("observation-after-capture");

  const limits = DEFAULT_LIMITS[unit];
  if (value !== null && limits && (value < limits[0] || value > limits[1])) errors.push("value-out-of-range");
  if (finite(observation.sourceTrust ?? observation.source_trust) === null) warnings.push("source-trust-missing");
  if (finite(observation.confidence) === null) warnings.push("confidence-missing");

  return { ok: errors.length === 0, errors, warnings };
}

export function summarizeObservationQuality(observations = [], options = {}) {
  let valid = 0;
  let warningRows = 0;
  const issues = new Map();
  for (const row of observations) {
    const result = validateSportsAnalyticsObservation(row, options);
    if (result.ok) valid += 1;
    if (result.warnings.length) warningRows += 1;
    for (const issue of [...result.errors, ...result.warnings]) issues.set(issue, (issues.get(issue) || 0) + 1);
  }
  const total = observations.length;
  return {
    total,
    valid,
    invalid: total - valid,
    warningRows,
    validRate: total ? Number((valid / total).toFixed(4)) : null,
    issues: [...issues.entries()].map(([issue, count]) => ({ issue, count })).sort((a, b) => b.count - a.count)
  };
}

export function detectMetricOutliers(observations = [], { minimumSamples = 8, zThreshold = 3.5, maximumResults = 50 } = {}) {
  const groups = new Map();
  for (const row of observations) {
    const value = finite(row.value);
    const metric = clean(row.metric, 120);
    const sport = clean(row.canonicalSport || row.canonical_sport || row.sport, 60);
    if (value === null || !metric) continue;
    const key = `${sport}:${metric}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, value });
  }

  const outliers = [];
  for (const [key, entries] of groups) {
    if (entries.length < minimumSamples) continue;
    const values = entries.map((entry) => entry.value);
    const mean = average(values);
    const deviation = standardDeviation(values, mean);
    if (!deviation) continue;
    for (const entry of entries) {
      const zScore = Math.abs((entry.value - mean) / deviation);
      if (zScore < zThreshold) continue;
      outliers.push({
        key,
        sport: clean(entry.row.canonicalSport || entry.row.canonical_sport || entry.row.sport, 60),
        metric: clean(entry.row.metric, 120),
        eventId: clean(entry.row.eventId || entry.row.event_id, 180),
        participantId: clean(entry.row.participantId || entry.row.participant_id, 120),
        provider: clean(entry.row.provider, 80),
        value: entry.value,
        mean: Number(mean.toFixed(4)),
        standardDeviation: Number(deviation.toFixed(4)),
        zScore: Number(zScore.toFixed(3)),
        observedAt: entry.row.observedAt || entry.row.observed_at || null
      });
    }
  }
  return outliers.sort((a, b) => b.zScore - a.zScore).slice(0, maximumResults);
}

export function buildSportsAnalyticsQualityReport(observations = [], options = {}) {
  return {
    generatedAt: new Date(options.now || Date.now()).toISOString(),
    validation: summarizeObservationQuality(observations, options),
    outliers: detectMetricOutliers(observations, options),
    rules: {
      missingValuesInvented: false,
      futureObservationsRejected: true,
      unitRangesValidated: true,
      statisticalOutliersAreWarningsOnly: true
    }
  };
}
