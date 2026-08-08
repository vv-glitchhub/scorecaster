import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compareTransparent1X2EvaluationPackages } from "../lib/transparent-1x2-paired-evidence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const has = (flag) => args.includes(flag);
const baselineArg = value("--baseline");
const challengerArg = value("--challenger");
const outputArg = value("--output") || "artifacts/transparent-1x2-paired-evidence.json";

if (!baselineArg || !challengerArg) {
  console.error("Usage: node scripts/compare-1x2-evaluation-packages.mjs --baseline <package.json> --challenger <package.json> [--output <comparison.json>] [--require-historical-pair]");
  process.exit(2);
}

async function readJson(relativeOrAbsolute) {
  const resolved = path.isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : path.resolve(root, relativeOrAbsolute);
  return JSON.parse(await readFile(resolved, "utf8"));
}

let baseline;
let challenger;
try {
  [baseline, challenger] = await Promise.all([readJson(baselineArg), readJson(challengerArg)]);
} catch (error) {
  console.error(`Unable to read paired evaluation packages: ${error?.message || error}`);
  process.exit(2);
}

const report = compareTransparent1X2EvaluationPackages({ baseline, challenger });
const outputPath = path.isAbsolute(outputArg) ? outputArg : path.resolve(root, outputArg);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  comparisonId: report.comparisonId,
  cohortFingerprint: report.cohortFingerprint,
  rowCount: report.rowCount,
  predictionsDiffer: report.predictionsDiffer,
  brierDelta: report.metrics?.deltaChallengerMinusBaseline?.brier ?? null,
  logLossDelta: report.metrics?.deltaChallengerMinusBaseline?.logLoss ?? null,
  directionalVerdict: report.metrics?.direction?.overall ?? "not-comparable",
  readyForManualReview: report.evidenceAssessment?.readyForManualReview === true,
  automaticPromotionAllowed: false,
  output: path.relative(root, outputPath)
}, null, 2));

if (!report.ok) process.exitCode = 1;
if (has("--require-historical-pair") && report.evidenceAssessment?.readyForManualReview !== true) {
  console.error("Paired evidence is not a sufficient reviewed historical pair.");
  process.exitCode = 1;
}
