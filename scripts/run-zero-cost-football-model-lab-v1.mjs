import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadZeroCostFootballLabDataset } from "../lib/zero-cost-football-open-data-loader-v1.mjs";
import { runZeroCostFootballModelLab } from "../lib/zero-cost-football-model-lab-v1.mjs";

function argument(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const output = resolve(argument("output", "artifacts/zero-cost-football-model-lab-v1-report.json"));
const startedAt = new Date().toISOString();

console.log(`[zero-cost-football-lab] starting at ${startedAt}`);
console.log("[zero-cost-football-lab] research-only: StatsBomb Open Data is not enabled for production or commercial deployment in Scorecaster");

const dataset = await loadZeroCostFootballLabDataset({ concurrency: 8 });
console.log(`[zero-cost-football-lab] paired historical matches: ${dataset.rows.length}; unmatched: ${dataset.unmatched.length}`);
console.log(`[zero-cost-football-lab] StatsBomb revision: ${dataset.manifest.statsBomb.revision}`);
console.log(`[zero-cost-football-lab] immutable input hash: ${dataset.manifest.immutableInputHash}`);

const evaluation = runZeroCostFootballModelLab(dataset.rows, {
  holdoutFraction: 0.30,
  ewmaAlpha: 0.24,
  priorMatches: 5,
  bootstrapSamples: 1500,
  bootstrapSeed: 1337,
  includeRows: false
});

const payload = {
  ok: evaluation.ok === true,
  generatedAt: new Date().toISOString(),
  startedAt,
  dataset: dataset.manifest,
  evaluation,
  unmatchedSample: dataset.unmatched.slice(0, 20),
  conclusion: {
    paidLiveDataStatus: evaluation.paidLiveDataDecision?.status || "inconclusive",
    paidLiveDataTrialJustified: evaluation.paidLiveDataDecision?.paidLiveDataTrialJustified === true,
    reason: evaluation.paidLiveDataDecision?.reason || "unknown",
    productionModelPromotionAllowed: false,
    productionPlayUpgradeAllowed: false,
    rawOpenDataRedistributed: false,
    paperOnly: true
  }
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const compact = {
  sampleSize: evaluation.sampleSize || 0,
  challengerBrier: evaluation.metrics?.challenger?.brier ?? null,
  marketBrier: evaluation.metrics?.marketChampion?.brier ?? null,
  brierSkillScore: evaluation.metrics?.skill?.brierSkillScore ?? null,
  challengerLogLoss: evaluation.metrics?.challenger?.logLoss ?? null,
  marketLogLoss: evaluation.metrics?.marketChampion?.logLoss ?? null,
  logLossImprovement: evaluation.metrics?.skill?.logLossImprovement ?? null,
  brierImprovement95: evaluation.metrics?.skill?.bootstrap?.brierImprovement95 ?? null,
  logLossImprovement95: evaluation.metrics?.skill?.bootstrap?.logLossImprovement95 ?? null,
  calibrationGap: evaluation.metrics?.challenger?.calibrationGap ?? null,
  marketCalibrationGap: evaluation.metrics?.marketChampion?.calibrationGap ?? null,
  paidLiveDataStatus: payload.conclusion.paidLiveDataStatus,
  paidLiveDataTrialJustified: payload.conclusion.paidLiveDataTrialJustified
};

console.log(`[zero-cost-football-lab] report written: ${output}`);
console.log(`ZERO_COST_LAB_RESULT=${JSON.stringify(compact)}`);

if (!evaluation.ok) process.exitCode = 1;
