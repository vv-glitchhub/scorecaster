export const CHAMPION_CHALLENGER_VERSION = "scorecaster-champion-challenger-v1";

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function status(model = {}) {
  const skill = model.marketBenchmark || {};
  if (skill.skillClaimAllowed === true) return "eligible-for-human-review";
  if (skill.reviewEligible === true) return "market-skill-review";
  if (model.status === "review-ready") return "holdout-review";
  if (model.status === "research") return "research";
  return "collecting";
}

function score(model = {}) {
  const skill = model.marketBenchmark || {};
  const brierSkill = finite(skill.brierSkillScore);
  const logImprovement = finite(skill.logLossImprovement);
  const sample = Math.min(1, Number(model.sampleSize || 0) / 100);
  if (brierSkill === null || logImprovement === null) return sample * 10;
  return Math.max(0, brierSkill * 55) + Math.max(0, logImprovement) * 25 + sample * 20;
}

export function buildChampionChallengerScorecard(report = {}) {
  const models = Array.isArray(report?.models) ? report.models : [];
  const challengers = models.map((model) => ({
    role: "challenger",
    modelId: model.modelId || null,
    modelVersion: model.modelVersion || null,
    sport: model.sport || null,
    sampleSize: Number(model.sampleSize || 0),
    pairedSampleSize: Number(model.marketBenchmark?.sampleSize || 0),
    brier: finite(model.brier),
    logLoss: finite(model.logLoss),
    calibrationGap: finite(model.calibrationGap),
    brierSkillScore: finite(model.marketBenchmark?.brierSkillScore),
    logLossImprovement: finite(model.marketBenchmark?.logLossImprovement),
    fullComparableSample: model.marketBenchmark?.fullComparableSample === true,
    beatsMarketOnBrier: model.marketBenchmark?.beatsMarketOnBrier ?? null,
    beatsMarketOnLogLoss: model.marketBenchmark?.beatsMarketOnLogLoss ?? null,
    status: status(model),
    evidenceScore: Number(score(model).toFixed(2)),
    automaticPromotionAllowed: false,
    productionWeightAvailable: false
  })).sort((a, b) => b.evidenceScore - a.evidenceScore || b.sampleSize - a.sampleSize);

  return {
    version: CHAMPION_CHALLENGER_VERSION,
    champion: {
      role: "production-benchmark",
      modelId: "no-vig-market-consensus",
      label: "No-vig market consensus",
      productionRole: "current benchmark / price anchor",
      independentPredictiveModel: false,
      replacedAutomatically: false
    },
    challengers,
    reviewQueue: challengers.filter((item) => item.status === "eligible-for-human-review"),
    contracts: {
      immutablePregameHoldoutRequired: true,
      pairedMarketBenchmarkRequired: true,
      minimumComparableRowsForSkillClaim: 100,
      positiveBrierSkillRequired: true,
      positiveLogLossImprovementRequired: true,
      automaticPromotionAllowed: false,
      rankingCanChangeProductionProbability: false,
      rankingCanUpgradeDecision: false,
      paperOnly: true,
      realMoneyActionAvailable: false
    }
  };
}
