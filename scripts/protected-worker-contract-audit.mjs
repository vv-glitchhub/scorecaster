import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "config/release-readiness.json"), "utf8"));
const reportPath = process.env.PROTECTED_WORKER_CONTRACT_REPORT_PATH
  ? path.resolve(root, process.env.PROTECTED_WORKER_CONTRACT_REPORT_PATH)
  : null;

function routeFile(apiPath) {
  return path.join(root, "app", ...apiPath.split("/").filter(Boolean), "route.js");
}

function relativeRouteFile(apiPath) {
  return path.relative(root, routeFile(apiPath)).replaceAll("\\", "/");
}

function firstIndex(text, patterns) {
  const indexes = patterns
    .map((pattern) => text.search(pattern))
    .filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

const workers = [];
const failures = [];

for (const worker of manifest.internalWorkers || []) {
  const file = routeFile(worker.path);
  const relativeFile = relativeRouteFile(worker.path);
  let source = "";
  try {
    source = await readFile(file, "utf8");
  } catch {
    const failure = `${worker.path}: route file is missing (${relativeFile})`;
    failures.push(failure);
    workers.push({ path: worker.path, method: worker.method, file: relativeFile, passed: false, failures: [failure] });
    continue;
  }

  const handlerIndex = source.indexOf(`export async function ${worker.method}`);
  const handler = handlerIndex >= 0 ? source.slice(handlerIndex) : "";
  const workerFailures = [];
  const cronGuard = /cronSecretConfigured|CRON_SECRET/.test(handler) || /cronSecretConfigured|CRON_SECRET/.test(source.slice(0, Math.max(handlerIndex, 0)));
  const authorizationGuard = /authorization|authorized/i.test(handler) || /AuthorizationValid|authorizationValid|authorized/.test(source.slice(0, Math.max(handlerIndex, 0)));
  const status503 = /\b503\b/.test(handler.slice(0, 1800));
  const status401 = /\b401\b/.test(handler.slice(0, 1800));
  const noStore = /Cache-Control["']?\s*:\s*["']no-store/i.test(source) || /["']Cache-Control["']\s*:\s*["']no-store/i.test(source);
  const unauthorizedIndex = handler.search(/Unauthorized|\b401\b/);
  const actionIndex = firstIndex(handler, [
    /getSupabaseAdmin(?:Client)?\s*\(/,
    /await\s+run[A-Z][A-Za-z0-9_]*\s*\(/,
    /await\s+fetch\s*\(/,
    /\.from\s*\(/
  ]);
  const guardBeforeAction = unauthorizedIndex >= 0 && (actionIndex < 0 || unauthorizedIndex < actionIndex);

  if (handlerIndex < 0) workerFailures.push(`missing exported ${worker.method} handler`);
  if (!cronGuard) workerFailures.push("missing CRON_SECRET/configured-secret guard");
  if (!authorizationGuard) workerFailures.push("missing authorization guard");
  if (!status503) workerFailures.push("missing fail-closed 503 path before worker execution");
  if (!status401) workerFailures.push("missing unauthorized 401 path before worker execution");
  if (!noStore) workerFailures.push("missing Cache-Control: no-store");
  if (!guardBeforeAction) workerFailures.push("authorization guard is not visibly before worker/admin action");

  failures.push(...workerFailures.map((failure) => `${worker.path}: ${failure}`));
  workers.push({
    path: worker.path,
    method: worker.method,
    file: relativeFile,
    expectedUnauthenticatedStatuses: worker.allowedStatuses,
    cronGuard,
    authorizationGuard,
    failClosed503: status503,
    unauthorized401: status401,
    noStore,
    guardBeforeAction,
    passed: workerFailures.length === 0,
    failures: workerFailures
  });
}

const report = {
  version: "scorecaster-protected-worker-contract-v1",
  generatedAt: new Date().toISOString(),
  workerCount: workers.length,
  passedWorkers: workers.filter((worker) => worker.passed).length,
  failedWorkers: workers.filter((worker) => !worker.passed).length,
  passed: failures.length === 0,
  workers,
  safety: {
    staticOnly: true,
    cronSecretValueRead: false,
    workerInvoked: false,
    paperRowsCreated: false,
    realMoneyExecution: false
  }
};

if (reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (failures.length) {
  console.error("Scorecaster protected-worker contract audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Scorecaster protected-worker contract audit passed: ${workers.length}/${workers.length} declared workers fail closed before visible worker/admin actions.`);
}
