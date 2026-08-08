import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditTransparent1X2ModelCandidateRegistry } from "../lib/transparent-1x2-model-candidate-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "config/transparent-1x2-model-candidates.json");
const outputPath = process.env.MODEL_CANDIDATE_REGISTRY_REPORT_PATH
  ? path.resolve(root, process.env.MODEL_CANDIDATE_REGISTRY_REPORT_PATH)
  : null;

const registry = JSON.parse(await readFile(registryPath, "utf8"));
const report = auditTransparent1X2ModelCandidateRegistry(registry);

if (outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  ok: report.ok,
  version: report.version,
  candidateCount: report.candidateCount,
  pendingCandidateCount: report.pendingCandidateCount,
  rejectedCandidateCount: report.rejectedCandidateCount,
  approvedCandidateCount: report.approvedCandidateCount,
  registryFingerprint: report.registryFingerprint,
  productionActivationEligible: false,
  automaticPromotionAllowed: false,
  runtimeLoadingAllowed: false,
  paperOnly: true
}, null, 2));

if (!report.ok) {
  console.error("Transparent 1X2 model candidate registry audit failed:");
  report.failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
}
