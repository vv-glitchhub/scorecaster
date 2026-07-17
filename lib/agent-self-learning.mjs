const EPSILON = 1e-6;

function clamp(value, min = EPSILON, max = 1 - EPSILON) {
  return Math.max(min, Math.min(max, Number(value)));
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function probabilityFromRow(row = {}) {
  const value = finite(
    row.modelProbability ??
    row.consensusProbability ??
    row.raw_pick?.modelProbability ??
    row.rawPick?.modelProbability
  );
  return value !== null && value > 0 && value < 1 ? value : null;
}

function outcomeFromRow(row = {}) {
  const result = String(row.result || row.status || "").toLowerCase();
  if (["win", "won"].includes(result)) return 1;
  if (["loss", "lost"].includes(result)) return 0;
  return null;
}

function timestampFromRow(row = {}, index = 0) {
  const value = Date.parse(row.createdAt || row.created_at || row.settledAt || row.settled_at || "");
  return Number.isFinite(value) ? value : index;
}

export function normalizeLearningSamples(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const probability = probabilityFromRow(row);
      const outcome = outcomeFromRow(row);
      if (probability === null || outcome === null) return null;
      return {
        id: String(row.id || `sample-${index}`),
        probability,
        outcome,
        timestamp: timestampFromRow(row, index),
        sportKey: String(row.sportKey || row.sport || row.league || "unknown"),
        marketKey: String(row.marketKey || row.market || "unknown")
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
}

function logit(probability) {
  const p = clamp(probability);
  return Math.log(p / (1 - p));
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

export function applyCalibrator(probability, candidate = { type: "identity" }) {
  const p = clamp(probability);
  if (!candidate || candidate.type === "identity") return p;

  if (candidate.type === "temperature") {
    const temperature = Math.max(0.35, Math.min(3, finite(candidate.temperature, 1)));
    return clamp(sigmoid(logit(p) / temperature));
  }

  if (candidate.type === "bias") {
    const bias = Math.max(-1.5, Math.min(1.5, finite(candidate.bias, 0)));
    return clamp(sigmoid(logit(p) + bias));
  }

  if (candidate.type === "shrink") {
    const strength = Math.max(0, Math.min(0.8, finite(candidate.strength, 0)));
    return clamp(0.5 + (p - 0.5) * (1 - strength));
  }

  return p;
}

export function scoreCalibrator(samples = [], candidate = { type: "identity" }) {
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

  let brierSum = 0;
  let logLossSum = 0;
  let expectedWins = 0;
  let actualWins = 0;

  samples.forEach((sample) => {
    const probability = applyCalibrator(sample.probability, candidate);
    brierSum += (probability - sample.outcome) ** 2;
    logLossSum += -(
      sample.outcome * Math.log(clamp(probability)) +
      (1 - sample.outcome) * Math.log(clamp(1 - probability))
    );
    expectedWins += probability;
    actualWins += sample.outcome;
  });

  const count = samples.length;
  const expectedWinRate = expectedWins / count;
  const actualWinRate = actualWins / count;
  return {
    count,
    brierScore: brierSum / count,
    logLoss: logLossSum / count,
    expectedWinRate,
    actualWinRate,
    calibrationGap: actualWinRate - expectedWinRate
  };
}

function candidateId(candidate) {
  if (candidate.type === "identity") return "identity";
  if (candidate.type === "temperature") return `temperature-${candidate.temperature}`;
  if (candidate.type === "bias") return `bias-${candidate.bias}`;
  if (candidate.type === "shrink") return `shrink-${candidate.strength}`;
  return "unknown";
}

function candidateGrid() {
  return [
    { type: "identity" },
    ...[0.7, 0.85, 1.15, 1.3, 1.5].map((temperature) => ({ type: "temperature", temperature })),
    ...[-0.3, -0.15, 0.15, 0.3].map((bias) => ({ type: "bias", bias })),
    ...[0.1, 0.2, 0.3, 0.4].map((strength) => ({ type: "shrink", strength }))
  ];
}

function rankCandidate(left, right) {
  const brierDifference = left.train.brierScore - right.train.brierScore;
  if (Math.abs(brierDifference) > 1e-9) return brierDifference;
  const logLossDifference = left.train.logLoss - right.train.logLoss;
  if (Math.abs(logLossDifference) > 1e-9) return logLossDifference;
  return left.id.localeCompare(right.id);
}

function evaluateDrift(samples) {
  if (samples.length < 90) {
    return {
      status: "insufficient",
      recentCount: Math.min(30, samples.length),
      referenceCount: Math.max(0, samples.length - Math.min(30, samples.length)),
      brierChange: null,
      calibrationGapChange: null,
      meanProbabilityChange: null,
      note: "Driftin arviointi vaatii vähintään 90 kronologista havaintoa."
    };
  }

  const recent = samples.slice(-30);
  const reference = samples.slice(-90, -30);
  const recentMetrics = scoreCalibrator(recent, { type: "identity" });
  const referenceMetrics = scoreCalibrator(reference, { type: "identity" });
  const recentMean = recent.reduce((sum, sample) => sum + sample.probability, 0) / recent.length;
  const referenceMean = reference.reduce((sum, sample) => sum + sample.probability, 0) / reference.length;
  const brierChange = recentMetrics.brierScore - referenceMetrics.brierScore;
  const calibrationGapChange = Math.abs(recentMetrics.calibrationGap) - Math.abs(referenceMetrics.calibrationGap);
  const meanProbabilityChange = Math.abs(recentMean - referenceMean);

  const critical = brierChange >= 0.08 || calibrationGapChange >= 0.14 || meanProbabilityChange >= 0.14;
  const warning = brierChange >= 0.04 || calibrationGapChange >= 0.08 || meanProbabilityChange >= 0.08;
  return {
    status: critical ? "critical" : warning ? "warning" : "stable",
    recentCount: recent.length,
    referenceCount: reference.length,
    recent: recentMetrics,
    reference: referenceMetrics,
    brierChange,
    calibrationGapChange,
    meanProbabilityChange,
    note: critical
      ? "Tuore data poikkeaa selvästi vertailujaksosta. Automaattinen mallipromootio jäädytetään."
      : warning
        ? "Tuoreessa datassa on mahdollinen drift. Ehdokasmalli pysyy varjotilassa."
        : "Tuore data ei osoita merkittävää kalibrointi- tai jakaumadriftiä."
  };
}

export function buildSelfLearningReport(rows = [], {
  minimumSamples = 120,
  holdoutFraction = 0.3,
  minimumBrierImprovement = 0.005
} = {}) {
  const samples = normalizeLearningSamples(rows);
  const sampleSize = samples.length;
  const drift = evaluateDrift(samples);

  if (sampleSize < minimumSamples) {
    return {
      version: "V11-model-lab",
      mode: "shadow-only",
      status: "insufficient-data",
      sampleSize,
      minimumSamples,
      trainSize: 0,
      holdoutSize: 0,
      champion: null,
      challenger: null,
      drift,
      promotion: {
        eligible: false,
        reasons: [`Tarvitaan vähintään ${minimumSamples} ratkaistua todennäköisyyshavaintoa.`]
      },
      safety: {
        chronologicalSplit: true,
        probabilityAppliedToProduction: false,
        automaticRealMoneyExecution: false
      }
    };
  }

  const holdoutSize = Math.max(36, Math.floor(sampleSize * holdoutFraction));
  const trainSize = sampleSize - holdoutSize;
  const train = samples.slice(0, trainSize);
  const holdout = samples.slice(trainSize);
  const candidates = candidateGrid().map((candidate) => ({
    id: candidateId(candidate),
    candidate,
    train: scoreCalibrator(train, candidate)
  })).sort(rankCandidate);

  const bestTrainingCandidate = candidates[0];
  const championCandidate = { type: "identity" };
  const champion = {
    id: "identity",
    candidate: championCandidate,
    train: scoreCalibrator(train, championCandidate),
    holdout: scoreCalibrator(holdout, championCandidate)
  };
  const challenger = {
    ...bestTrainingCandidate,
    holdout: scoreCalibrator(holdout, bestTrainingCandidate.candidate)
  };

  const brierImprovement = champion.holdout.brierScore - challenger.holdout.brierScore;
  const logLossImprovement = champion.holdout.logLoss - challenger.holdout.logLoss;
  const calibrationImprovement = Math.abs(champion.holdout.calibrationGap) - Math.abs(challenger.holdout.calibrationGap);
  const reasons = [];

  if (challenger.id === "identity") reasons.push("Koulutusjakso ei löytänyt nykyistä mallia parempaa kalibraattoria.");
  if (brierImprovement < minimumBrierImprovement) reasons.push(`Holdout-Brier ei parantunut vähintään ${minimumBrierImprovement.toFixed(3)}.`);
  if (logLossImprovement < 0) reasons.push("Holdout-log loss heikkeni.");
  if (calibrationImprovement < -0.01) reasons.push("Holdout-kalibrointivirhe heikkeni liikaa.");
  if (["warning", "critical"].includes(drift.status)) reasons.push("Datadrift estää automaattisen promootion.");

  const eligible = reasons.length === 0;
  return {
    version: "V11-model-lab",
    mode: "shadow-only",
    status: drift.status === "critical"
      ? "frozen-drift"
      : eligible
        ? "promotion-ready"
        : "challenger-rejected",
    sampleSize,
    minimumSamples,
    trainSize,
    holdoutSize,
    champion,
    challenger: {
      ...challenger,
      holdoutImprovement: {
        brier: brierImprovement,
        logLoss: logLossImprovement,
        calibration: calibrationImprovement
      }
    },
    drift,
    promotion: {
      eligible,
      reasons: eligible
        ? ["Ehdokas läpäisi kronologisen holdout-portin, mutta pysyy varjotilassa kunnes malliversio hyväksytään erikseen."]
        : reasons
    },
    safety: {
      chronologicalSplit: true,
      candidateSelectedOnTrainingOnly: true,
      evaluatedOnUntouchedHoldout: true,
      probabilityAppliedToProduction: false,
      automaticRealMoneyExecution: false
    }
  };
}
