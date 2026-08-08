import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildTransparent1X2EvaluationPackage } from "../lib/transparent-1x2-evaluation-package.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const has = (flag) => args.includes(flag);
const inputArg = value("--input");
const outputArg = value("--output") || "artifacts/transparent-1x2-evaluation-package.json";

if (!inputArg) {
  console.error("Usage: node scripts/build-1x2-evaluation-package.mjs --input <dataset.json> [--output <evidence.json>] [--require-historical-evidence]");
  process.exit(2);
}

const inputPath = path.resolve(root, inputArg);
const outputPath = path.resolve(root, outputArg);
let payload;
try {
  payload = JSON.parse(await readFile(inputPath, "utf8"));
} catch (error) {
  console.error(`Unable to read evaluation input: ${error?.message || error}`);
  process.exit(2);
}

const report = buildTransparent1X2EvaluationPackage({
  manifest: payload?.manifest,
  records: payload?.records,
  options: payload?.options
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  version: report.version,
  packageId: report.packageId || null,
  datasetId: report.dataset?.datasetId || null,
  datasetKind: report.dataset?.datasetKind || null,
  rowCount: report.dataset?.rowCount ?? 0,
  datasetFingerprint: report.dataset?.datasetFingerprint || null,
  resultFingerprint: report.resultFingerprint || null,
  canCountAsHistoricalValidation: report.evidenceAssessment?.canCountAsHistoricalValidation === true,
  automaticPromotionAllowed: false,
  output: path.relative(root, outputPath)
}, null, 2));

if (!report.ok) process.exitCode = 1;
if (has("--require-historical-evidence") && report.evidenceAssessment?.canCountAsHistoricalValidation !== true) {
  console.error("Evaluation package is not eligible to count as real historical validation evidence.");
  process.exitCode = 1;
}
