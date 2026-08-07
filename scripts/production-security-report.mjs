import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProductionSecurityEvidence } from "../lib/production-security-evidence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(await readFile(path.join(root, "config/production-security.json"), "utf8"));
const reportPath = path.resolve(root, process.env.SCORECASTER_SECURITY_REPORT_PATH || "artifacts/production-security.json");
const requirePresent = process.argv.includes("--require-present");

const report = buildProductionSecurityEvidence({ policy, env: process.env });

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (!report.serverOnlyBoundaryClean) {
  console.error(`Production security boundary failed: forbidden client aliases are present: ${report.forbiddenClientAliases.join(", ")}`);
  process.exitCode = 1;
} else if (requirePresent && !report.requiredConfigurationPresent) {
  console.error("Production security configuration is incomplete. Missing variable names only:");
  [...report.missingRequiredServerOnly, ...report.missingPublicClient].forEach((name) => console.error(`- ${name}`));
  process.exitCode = 1;
} else {
  console.log(`Production security evidence written to ${path.relative(root, reportPath).replaceAll("\\", "/")}.`);
  console.log(`Server-only boundary: ${report.serverOnlyBoundaryClean ? "clean" : "failed"}. Required configuration present: ${report.requiredConfigurationPresent}.`);
  if (!requirePresent && !report.requiredConfigurationPresent) console.log("Missing production variables are informational in repository/CI mode; use --require-present in the real production configuration environment.");
}
