function finite(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function cleanLabel(value, limit = 80) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

export const DEFAULT_GOLF_DISTANCE_BUCKETS_METERS = Object.freeze([
  [0, 30], [30, 50], [50, 75], [75, 100], [100, 125], [125, 150], [150, 175], [175, 200], [200, Number.POSITIVE_INFINITY]
]);

export function golfDistanceBucket(distanceMeters, buckets = DEFAULT_GOLF_DISTANCE_BUCKETS_METERS) {
  const distance = finite(distanceMeters);
  if (distance === null || distance < 0) return null;
  const match = buckets.find(([minimum, maximum]) => distance >= minimum && distance < maximum);
  if (!match) return null;
  const [minimum, maximum] = match;
  return maximum === Number.POSITIVE_INFINITY ? `${minimum}+ m` : `${minimum}-${maximum} m`;
}

export function calculateExpectedActionValue({ beforeValue, afterValue, actionCost = 0, higherIsBetter = true } = {}) {
  const before = finite(beforeValue);
  const after = finite(afterValue);
  const cost = finite(actionCost, 0);
  if (before === null || after === null) return null;
  const raw = higherIsBetter ? after - before - cost : before - after - cost;
  return round(raw);
}

export function calculateExpectedDecisionValue({ chosenValue, alternatives = [], higherIsBetter = true } = {}) {
  const chosen = finite(chosenValue);
  const candidates = (alternatives || []).map((value) => finite(value)).filter((value) => value !== null);
  if (chosen === null || candidates.length === 0) return null;
  const bestAlternative = higherIsBetter ? Math.max(...candidates) : Math.min(...candidates);
  const decisionValue = higherIsBetter ? chosen - bestAlternative : bestAlternative - chosen;
  return {
    chosenValue: round(chosen),
    bestAlternativeValue: round(bestAlternative),
    decisionValue: round(decisionValue),
    optimal: decisionValue >= 0
  };
}

export function calculateExpectedPoints({ probability, points } = {}) {
  const p = finite(probability);
  const value = finite(points);
  if (p === null || value === null || p < 0 || p > 1) return null;
  return round(p * value);
}

export function calculateProximityGained({ expectedDistanceMeters, actualDistanceMeters } = {}) {
  const expected = finite(expectedDistanceMeters);
  const actual = finite(actualDistanceMeters);
  if (expected === null || actual === null || expected < 0 || actual < 0) return null;
  return round(expected - actual, 3);
}

export function calculateTargetZoneRate(observations = [], thresholdMeters = 3) {
  const threshold = finite(thresholdMeters);
  if (threshold === null || threshold < 0) return null;
  const valid = (observations || []).map((row) => finite(row?.endDistanceMeters)).filter((value) => value !== null && value >= 0);
  if (!valid.length) return null;
  return round(valid.filter((value) => value <= threshold).length / valid.length);
}

export function buildGolfProximityProfile(observations = [], options = {}) {
  const thresholds = (options.thresholdsMeters || [1, 3, 5, 10]).map((value) => finite(value)).filter((value) => value !== null && value >= 0);
  const rows = new Map();

  for (const observation of observations || []) {
    const startDistance = finite(observation?.startDistanceMeters);
    const endDistance = finite(observation?.endDistanceMeters);
    if (startDistance === null || endDistance === null || startDistance < 0 || endDistance < 0) continue;
    const bucket = golfDistanceBucket(startDistance, options.buckets || DEFAULT_GOLF_DISTANCE_BUCKETS_METERS);
    if (!bucket) continue;
    if (!rows.has(bucket)) {
      rows.set(bucket, {
        bucket,
        samples: 0,
        startTotal: 0,
        endTotal: 0,
        greenHits: 0,
        greenHitKnown: 0,
        proximityGainedTotal: 0,
        proximityGainedSamples: 0,
        targetHits: Object.fromEntries(thresholds.map((threshold) => [String(threshold), 0]))
      });
    }
    const row = rows.get(bucket);
    row.samples += 1;
    row.startTotal += startDistance;
    row.endTotal += endDistance;
    if (typeof observation.greenHit === "boolean") {
      row.greenHitKnown += 1;
      if (observation.greenHit) row.greenHits += 1;
    }
    const expectedDistance = finite(observation.expectedEndDistanceMeters);
    if (expectedDistance !== null && expectedDistance >= 0) {
      row.proximityGainedSamples += 1;
      row.proximityGainedTotal += expectedDistance - endDistance;
    }
    for (const threshold of thresholds) {
      if (endDistance <= threshold) row.targetHits[String(threshold)] += 1;
    }
  }

  const bucketOrder = (options.buckets || DEFAULT_GOLF_DISTANCE_BUCKETS_METERS).map(([minimum, maximum]) => maximum === Number.POSITIVE_INFINITY ? `${minimum}+ m` : `${minimum}-${maximum} m`);
  return bucketOrder.filter((bucket) => rows.has(bucket)).map((bucket) => {
    const row = rows.get(bucket);
    return {
      bucket,
      samples: row.samples,
      averageStartDistanceMeters: round(row.startTotal / row.samples, 2),
      averageEndDistanceMeters: round(row.endTotal / row.samples, 2),
      greenHitRate: row.greenHitKnown ? round(row.greenHits / row.greenHitKnown) : null,
      proximityGainedMeters: row.proximityGainedSamples ? round(row.proximityGainedTotal / row.proximityGainedSamples, 3) : null,
      targetZoneRates: Object.fromEntries(thresholds.map((threshold) => [
        `${threshold}m`,
        round(row.targetHits[String(threshold)] / row.samples)
      ]))
    };
  });
}

export function calculateDataConfidence({ sampleSize = 0, freshnessSeconds = null, providerCount = 1, agreement = 1, completeness = 1 } = {}) {
  const samples = Math.max(0, finite(sampleSize, 0));
  const providers = Math.max(0, finite(providerCount, 0));
  const agreementScore = clamp(finite(agreement, 0), 0, 1);
  const completenessScore = clamp(finite(completeness, 0), 0, 1);
  const freshness = finite(freshnessSeconds);

  const sampleScore = 1 - Math.exp(-samples / 75);
  const providerScore = clamp(providers / 4, 0, 1);
  const freshnessScore = freshness === null ? 0.5 : Math.exp(-Math.max(0, freshness) / 7200);
  const score = clamp(
    sampleScore * 0.3 + providerScore * 0.2 + agreementScore * 0.2 + completenessScore * 0.2 + freshnessScore * 0.1,
    0,
    1
  );

  return {
    score: round(score),
    grade: score >= 0.85 ? "A" : score >= 0.7 ? "B" : score >= 0.5 ? "C" : score >= 0.3 ? "D" : "E",
    components: {
      sample: round(sampleScore),
      provider: round(providerScore),
      agreement: round(agreementScore),
      completeness: round(completenessScore),
      freshness: round(freshnessScore)
    }
  };
}

export function normalizeAnalyticsObservation(input = {}) {
  const timestamp = Date.parse(input.observedAt || input.timestamp || "");
  const value = finite(input.value);
  return {
    sport: cleanLabel(input.sport, 40).toLowerCase().replace(/[\s-]+/g, "_"),
    eventId: cleanLabel(input.eventId, 120),
    participantId: cleanLabel(input.participantId, 120),
    metric: cleanLabel(input.metric, 120).toLowerCase().replace(/[\s_]+/g, "-"),
    value,
    unit: cleanLabel(input.unit, 30),
    observedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
    provider: cleanLabel(input.provider, 80),
    sourceTrust: clamp(finite(input.sourceTrust, 0), 0, 1),
    confidence: clamp(finite(input.confidence, 0), 0, 1),
    metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {}
  };
}
