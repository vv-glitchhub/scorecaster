import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadZeroCostFootballMlDataset } from "../lib/zero-cost-football-open-data-loader-v2.mjs";
import { runFootballMlChallengerLab } from "../lib/football-ml-challenger-v1.mjs";

function argument(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function compactModel(model = {}) {
  return {
    version: model.version || null,
    family: model.family || null,
    featureNames: model.featureNames || [],
    rounds: Array.isArray(model.rounds) ? model.rounds.length : 0,
    learningRate: model.learningRate ?? null,
    temperature: model.temperature ?? null,
    params: model.params || null,
    training: model.training || null,
    featureImportance: Array.isArray(model.featureImportance) ? model.featureImportance.slice(0, 12) : [],
    safety: model.safety || null
  };
}

const reportPath = resolve(argument("report", "artifacts/football-ml-challenger-v1-report.json"));
const modelPath = resolve(argument("model", "artifacts/football-ml-challenger-v1-model.json"));
const latestPath = resolve(argument("latest", "config/football-ml-challenger-v1-latest.json"));
const startedAt = new Date().toISOString();

console.log(`[football-ml] starting ${startedAt}`);
console.log("[football-ml] research-only; production probability and PLAY remain unchanged");

const dataset = await loadZeroCostFootballMlDataset({ concurrency: 8 });
console.log(`[football-ml] paired rows=${dataset.rows.length}; unmatched=${dataset.unmatched.length}`);
console.log(`[football-ml] immutable input=${dataset.manifest.immutableInputHash}`);

const evaluation = runFootballMlChallengerLab(dataset.rows, {
  ewmaAlpha: 0.22,
  priorMatches: 5,
  validationFraction: 0.15,
  holdoutFraction: 0.30,
  learningRate: 0.06,
  maxDepth: 2,
  minLeaf: 10,
  maxBins: 12,
  maxRounds: 80,
  earlyStoppingRounds: 12,
  bootstrapSamples: 2000,
  bootstrapSeed: 20260825
});

if (!evaluation.ok) {
  console.error(`[football-ml] evaluation failed: ${evaluation.reason}`);
  process.exitCode = 1;
}

const report = {
  version: "scorecaster-football-ml-challenger-report-v1",
  generatedAt: new Date().toISOString(),
  startedAt,
  dataset: dataset.manifest,
  evaluation: evaluation.ok ? { ...evaluation, model: compactModel(evaluation.model) } : evaluation,
  safety: {
    researchOnly: true,
    openDataProductionUseAllowed: false,
    productionModelPromotionAllowed: false,
    productionProbabilityChanged: false,
    productionPlayUpgradeAllowed: false,
    realMoneyActionAvailable: false,
    paperOnly: true
  }
};

const modelArtifact = evaluation.ok ? {
  version: "scorecaster-football-ml-serialized-model-artifact-v1",
  generatedAt: report.generatedAt,
  datasetIdentity: {
    immutableInputHash: dataset.manifest.immutableInputHash,
    statsBombRevision: dataset.manifest.statsBomb.revision,
    statsBombEventBundleHash: dataset.manifest.statsBomb.eventBundleHash,
    footballDataContentHash: dataset.manifest.footballData.contentHash
  },
  split: evaluation.split,
  ensembleWeights: evaluation.ensembleWeights,
  model: evaluation.model,
  deployment: {
    researchOnly: true,
    productionInferenceEnabled: false,
    activationRequiresSeparateEntitledLiveFeaturePipeline: true,
    automaticPromotionAllowed: false
  }
} : null;

const latest = evaluation.ok ? {
  version: "scorecaster-football-ml-challenger-latest-v1",
  status: "evaluated",
  updatedAt: report.generatedAt,
  dataset: {
    competition: dataset.manifest.statsBomb.competition,
    season: dataset.manifest.statsBomb.season,
    pairedRows: dataset.manifest.pairing.pairedRows,
    immutableInputHash: dataset.manifest.immutableInputHash,
    researchOnly: true,
    productionUseAllowed: false
  },
  split: evaluation.split,
  metrics: evaluation.metrics,
  comparisons: evaluation.comparisons,
  ensembleWeights: evaluation.ensembleWeights,
  champion: evaluation.champion,
  paidLiveDataDecision: evaluation.paidLiveDataDecision,
  model: compactModel(evaluation.model),
  safety: evaluation.safety
} : {
  version: "scorecaster-football-ml-challenger-latest-v1",
  status: "failed",
  updatedAt: report.generatedAt,
  reason: evaluation.reason || "unknown",
  safety: report.safety
};

for (const [path, payload] of [[reportPath, report], [latestPath, latest]]) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
if (modelArtifact) {
  await mkdir(dirname(modelPath), { recursive: true });
  await writeFile(modelPath, `${JSON.stringify(modelArtifact, null, 2)}\n`, "utf8");
}

const compact = evaluation.ok ? {
  sampleSize: evaluation.split.holdout,
  marketBrier: evaluation.metrics.market.brier,
  poissonBrier: evaluation.metrics.poisson.brier,
  mlBrier: evaluation.metrics.ml.brier,
  ensembleBrier: evaluation.metrics.ensemble.brier,
  marketLogLoss: evaluation.metrics.market.logLoss,
  poissonLogLoss: evaluation.metrics.poisson.logLoss,
  mlLogLoss: evaluation.metrics.ml.logLoss,
  ensembleLogLoss: evaluation.metrics.ensemble.logLoss,
  mlBrier95: evaluation.comparisons.mlVsMarket.bootstrap.brierImprovement95,
  mlLogLoss95: evaluation.comparisons.mlVsMarket.bootstrap.logLossImprovement95,
  ensembleBrier95: evaluation.comparisons.ensembleVsMarket.bootstrap.brierImprovement95,
  ensembleLogLoss95: evaluation.comparisons.ensembleVsMarket.bootstrap.logLossImprovement95,
  selectedRounds: evaluation.model.training.selectedRounds,
  temperature: evaluation.model.temperature,
  ensembleWeights: evaluation.ensembleWeights,
  humanReviewCandidate: evaluation.champion.humanReviewCandidate,
  paidLiveDataStatus: evaluation.paidLiveDataDecision.status
} : { ok: false, reason: evaluation.reason };

console.log(`[football-ml] report=${reportPath}`);
console.log(`[football-ml] model=${modelArtifact ? modelPath : "not-created"}`);
console.log(`[football-ml] latest=${latestPath}`);
console.log(`FOOTBALL_ML_RESULT=${JSON.stringify(compact)}`);
