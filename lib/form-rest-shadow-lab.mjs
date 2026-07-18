const EPSILON = 1e-6;

function clamp(value, min = EPSILON, max = 1 - EPSILON) {
  return Math.max(min, Math.min(max, Number(value)));
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function outcomeFromRow(row = {}) {
  const result = String(row.result || row.status || "").toLowerCase();
  if (["win", "won"].includes(result)) return 1;
  if (["loss", "lost"].includes(result)) return 0;
  return null;
}

function timestampFromRow(row = {}, index = 0) {
  const value = Date.parse(
    row.raw_pick?.featureSnapshotStoredAt ||
    row.rawPick?.featureSnapshotStoredAt ||
    row.created_at ||
    row.createdAt ||
    row.updated_at ||
    ""
  );
  return Number.isFinite(value) ? value : index;
}

function snapshotFromRow(row = {}) {
  const raw = row.raw_pick && typeof row.raw_pick === "object"
    ? row.raw_pick
    : row.rawPick && typeof row.rawPick === "object"
      ? row.rawPick
      : {};
  const snapshot = raw.featureSnapshot && typeof raw.featureSnapshot === "object"
    ? raw.featureSnapshot
    : null;
  if (!snapshot || snapshot.version !== "form-rest-shadow-v1") return null;
  if (raw.featureSnapshotSource !== "server-top-picks") return null;
  if (snapshot.probabilityAppliedToProduction !== false || snapshot.usedForDecision !== false) return null;
  if (snapshot.chronologyGuard !== true) return null;
  return snapshot;
}

export function normalizeFormRestShadowSamples(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const outcome = outcomeFromRow(row);
      const snapshot = snapshotFromRow(row);
      const marketProbability = finite(snapshot?.marketProbability);
      const shadowProbability = finite(snapshot?.shadowProbability);
      if (outcome === null || !snapshot) return null;
      if (marketProbability === null || marketProbability <= 0 || marketProbability >= 1) return null;
      if (shadowProbability === null || shadowProbability <= 0 || shadowProbability >= 1) return null;
      if (snapshot.status !== "ready") return null;

      return {
        id: String(row.id || `shadow-sample-${index}`),
        timestamp: timestampFromRow(row, index),
        outcome,
        marketProbability: clamp(marketProbability),
        shadowProbability: clamp(shadowProbability),
        sportKey: String(snapshot.sportKey || row.sport || row.league || "unknown"),
        modelId: String(snapshot.modelId || "unknown"),
        homeSampleSize: Math.max(0, Number(snapshot.home?.sampleSize || 0)),
        awaySampleSize: Math.max(0, Number(snapshot.away?.sampleSize || 0))
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

export function scoreShadowSamples(samples = [], probabilityKey = "shadowProbability") {
  if (!samples.length) {
    return {
      count: 0,
      brierScore: null,
      logLoss: null,
      expectedWinRate: null,
      actualWinRate: null,
      calibrationGap: null
    };
  }

  let brier = 0;
  let logLoss = 0;
  let expected = 0;
  let actual = 0;
  samples.forEach((sample) => {
    const probability = clamp(sample[probabilityKey]);
    brier += (probability - sample.outcome) ** 2;
    logLoss += -(
      sample.outcome * Math.log(probability) +
      (1 - sample.outcome) * Math.log(1 - probability)
    );
    expected += probability;
    actual += sample.outcome;
  });

  const count = samples.length;
  return {
    count,
    brierScore: brier / count,
    logLoss: logLoss / count,
    expectedWinRate: expected / count,
    actualWinRate: actual / count,
    calibrationGap: actual / count - expected / count
  };
}

function comparison(samples) {
  const champion = scoreShadowSamples(samples, "marketProbability");
  const challenger = scoreShadowSamples(samples, "shadowProbability");
  return {
    champion,
    challenger,
    improvement: {
      brier: champion.brierScore === null || challenger.brierScore === null
        ? null
        : champion.brierScore - challenger.brierScore,
      logLoss: champion.logLoss === null || challenger.logLoss === null
        ? null
        : champion.logLoss - challenger.logLoss,
      calibration: champion.calibrationGap === null || challenger.calibrationGap === null
        ? null
        : Math.abs(champion.calibrationGap) - Math.abs(challenger.calibrationGap)
    }
  };
}

function bySport(samples) {
  const groups = new Map();
  samples.forEach((sample) => {
    if (!groups.has(sample.sportKey)) groups.set(sample.sportKey, []);
    groups.get(sample.sportKey).push(sample);
  });
  return Object.fromEntries(
    [...groups.entries()].map(([sportKey, rows]) => [sportKey, comparison(rows)])
  );
}

export function buildFormRestShadowLab(rows = [], {
  minimumSamples = 40,
  holdoutFraction = 0.3,
  minimumHoldout = 12
} = {}) {
  const samples = normalizeFormRestShadowSamples(rows);
  const sampleSize = samples.length;
  const excludedRows = Math.max(0, (Array.isArray(rows) ? rows.length : 0) - sampleSize);

  if (sampleSize < minimumSamples) {
    return {
      version: "V11-form-rest-shadow-lab",
      mode: "shadow-only",
      status: "insufficient-data",
      sampleSize,
      minimumSamples,
      trainSize: 0,
      holdoutSize: 0,
      excludedRows,
      champion: { id: "market-consensus", metrics: scoreShadowSamples(samples, "marketProbability") },
      challenger: { id: "form-rest-shadow-v1", metrics: scoreShadowSamples(samples, "shadowProbability") },
      bySport: bySport(samples),
      promotion: {
        eligible: false,
        reasons: [`At least ${minimumSamples} server-audited settled samples are required.`]
      },
      safety: {
        chronologicalSplit: true,
        serverVerifiedSnapshotsOnly: true,
        futureEventsExcludedBySnapshot: true,
        probabilityAppliedToProduction: false,
        automaticPromotionAvailable: false
      }
    };
  }

  const holdoutSize = Math.max(minimumHoldout, Math.floor(sampleSize * holdoutFraction));
  const trainSize = sampleSize - holdoutSize;
  const train = samples.slice(0, trainSize);
  const holdout = samples.slice(trainSize);
  const trainComparison = comparison(train);
  const holdoutComparison = comparison(holdout);
  const holdoutImprovesBrier = Number(holdoutComparison.improvement.brier || 0) > 0;
  const holdoutImprovesLogLoss = Number(holdoutComparison.improvement.logLoss || 0) > 0;

  return {
    version: "V11-form-rest-shadow-lab",
    mode: "shadow-only",
    status: holdoutImprovesBrier && holdoutImprovesLogLoss ? "shadow-outperformed" : "shadow-did-not-outperform",
    sampleSize,
    minimumSamples,
    trainSize,
    holdoutSize,
    excludedRows,
    champion: {
      id: "market-consensus",
      train: trainComparison.champion,
      holdout: holdoutComparison.champion
    },
    challenger: {
      id: "form-rest-shadow-v1",
      train: trainComparison.challenger,
      holdout: holdoutComparison.challenger,
      holdoutImprovement: holdoutComparison.improvement
    },
    bySport: bySport(holdout),
    promotion: {
      eligible: false,
      reasons: [
        holdoutImprovesBrier && holdoutImprovesLogLoss
          ? "The shadow model outperformed on this holdout, but V1 has no automatic promotion path."
          : "The shadow model did not beat the market benchmark on both holdout metrics.",
        "A separately reviewed sport-specific model version and larger sample are required before any production experiment."
      ]
    },
    safety: {
      chronologicalSplit: true,
      candidateDefinedBeforeHoldout: true,
      evaluatedOnUntouchedHoldout: true,
      serverVerifiedSnapshotsOnly: true,
      futureEventsExcludedBySnapshot: true,
      probabilityAppliedToProduction: false,
      automaticPromotionAvailable: false
    }
  };
}
