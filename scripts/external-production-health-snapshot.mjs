import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = String(process.env.PRODUCTION_EVIDENCE_BASE_URL || "https://scorecaster.vercel.app").replace(/\/$/, "");
const reportPath = process.env.EXTERNAL_PRODUCTION_HEALTH_REPORT_PATH
  ? path.resolve(root, process.env.EXTERNAL_PRODUCTION_HEALTH_REPORT_PATH)
  : null;
const clean = (value, maximum = 160) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

const parsed = new URL(baseUrl);
if (parsed.protocol !== "https:" || parsed.host !== "scorecaster.vercel.app") {
  console.error("Production health snapshot refuses non-production host.");
  process.exit(2);
}

const response = await fetch(new URL("/api/health", `${baseUrl}/`), {
  method: "GET",
  cache: "no-store",
  redirect: "error",
  headers: { Accept: "application/json", "User-Agent": "Scorecaster-External-Health/1.0" }
});
const failures = [];
const contentType = clean(response.headers.get("content-type"), 120).toLowerCase();
const cacheControl = clean(response.headers.get("cache-control"), 180).toLowerCase();
const ageRaw = response.headers.get("age");
const ageSeconds = ageRaw !== null && /^\d+$/.test(ageRaw) ? Number(ageRaw) : null;
const vercelCache = clean(response.headers.get("x-vercel-cache"), 32).toUpperCase() || null;
if (response.status !== 200) failures.push(`http-status-not-200:${response.status}`);
if (!contentType.includes("application/json")) failures.push("content-type-not-json");
if (!cacheControl.includes("no-store")) failures.push("cache-control-missing-no-store");
if (ageSeconds !== null && ageSeconds !== 0) failures.push("age-not-zero");
if (["HIT", "STALE"].includes(vercelCache || "")) failures.push(`api-cache-state-forbidden:${vercelCache}`);

let payload = null;
try {
  payload = await response.json();
} catch {
  failures.push("response-json-invalid");
}
if (payload?.status !== "ok") failures.push("health-status-not-ok");
if (payload?.service !== "scorecaster") failures.push("health-service-mismatch");
const gitCommit = clean(payload?.gitCommit, 80).toLowerCase();
if (!/^[0-9a-f]{7,64}$/.test(gitCommit)) failures.push("health-git-commit-invalid");

const report = {
  version: "scorecaster-external-production-health-snapshot-v1",
  observedAt: new Date().toISOString(),
  source: {
    host: parsed.host,
    path: "/api/health",
    httpStatus: response.status,
    contentType,
    cacheControl,
    ageSeconds,
    vercelCache
  },
  runtime: {
    service: clean(payload?.service, 80) || null,
    status: clean(payload?.status, 32) || null,
    gitCommit: gitCommit || null,
    databaseConfigured: payload?.databaseConfigured === true,
    oddsApiConfigured: payload?.oddsApiConfigured === true,
    cronSecretConfigured: payload?.cronSecretConfigured === true,
    agentDecisionSigningConfigured: payload?.agentV10DecisionSigningConfigured === true,
    openAiConfigured: payload?.openAiConfigured === true,
    shadowLearningEnabled: payload?.shadowLearningEnabled === true,
    realMoneyExecutionEnabled: payload?.realMoneyExecutionEnabled === true
  },
  evidenceBoundary: {
    secretValuesRetained: false,
    credentialsSent: false,
    userIdentifiersRetained: false,
    rawProviderPayloadsRetained: false
  },
  structuralPassed: failures.length === 0,
  failures: [...new Set(failures)].sort()
};

if (report.runtime.realMoneyExecutionEnabled) failures.push("real-money-execution-must-be-disabled");
report.failures = [...new Set(failures)].sort();
report.structuralPassed = report.failures.length === 0;

if (reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(report, null, 2));
if (!report.structuralPassed) process.exitCode = 1;
