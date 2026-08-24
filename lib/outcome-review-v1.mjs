export const OUTCOME_REVIEW_VERSION = "scorecaster-outcome-review-v1";

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values = []) {
  const rows = values.map(finite).filter((value) => value !== null);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
}

function round(value, digits = 4) {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function bucketFor(record = {}) {
  const outcome = finite(record.outcomeValue ?? record.outcome_value);
  const priceClv = finite(record.priceClv ?? record.price_clv);
  if (![0, 1].includes(outcome) || priceClv === null) return null;
  const processPositive = priceClv > 0;
  if (processPositive && outcome === 1) return "good-process-good-outcome";
  if (processPositive && outcome === 0) return "good-process-bad-outcome";
  if (!processPositive && outcome === 1) return "weak-process-good-outcome";
  return "weak-process-bad-outcome";
}

function summarize(key, records) {
  const count = records.length;
  const wins = records.filter((row) => finite(row.outcomeValue ?? row.outcome_value) === 1).length;
  return {
    key,
    count,
    share: null,
    wins,
    losses: count - wins,
    hitRate: count ? round(wins / count) : null,
    averagePriceClv: round(average(records.map((row) => row.priceClv ?? row.price_clv))),
    averageProbabilityClv: round(average(records.map((row) => row.probabilityClv ?? row.probability_clv))),
    averageBrier: round(average(records.map((row) => row.brier ?? row.brierScore ?? row.brier_score))),
    averageLogLoss: round(average(records.map((row) => row.logLoss ?? row.log_loss))),
    averageProfit: round(average(records.map((row) => row.profit)))
  };
}

export function buildOutcomeReview(records = []) {
  const source = Array.isArray(records) ? records : [];
  const classified = source
    .map((record) => ({ record, bucket: bucketFor(record) }))
    .filter((row) => row.bucket);
  const keys = [
    "good-process-good-outcome",
    "good-process-bad-outcome",
    "weak-process-good-outcome",
    "weak-process-bad-outcome"
  ];
  const buckets = keys.map((key) => summarize(key, classified.filter((row) => row.bucket === key).map((row) => row.record)));
  const total = classified.length;
  for (const bucket of buckets) bucket.share = total ? round(bucket.count / total) : null;

  const goodProcess = buckets.filter((bucket) => bucket.key.startsWith("good-process")).reduce((sum, bucket) => sum + bucket.count, 0);
  const weakProcess = total - goodProcess;
  const wins = classified.filter((row) => finite(row.record.outcomeValue ?? row.record.outcome_value) === 1).length;

  return {
    version: OUTCOME_REVIEW_VERSION,
    paperOnly: true,
    sampleSize: total,
    excludedForMissingOutcomeOrClv: Math.max(0, source.length - total),
    goodProcessRate: total ? round(goodProcess / total) : null,
    weakProcessRate: total ? round(weakProcess / total) : null,
    hitRate: total ? round(wins / total) : null,
    buckets,
    contracts: {
      processQualityUsesClosingLineValue: true,
      outcomeDoesNotRetroactivelyChangeDecision: true,
      goodLossCanExist: true,
      badWinCanExist: true,
      automaticModelPromotionAllowed: false,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      realMoneyActionAvailable: false
    }
  };
}
