import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = String(process.env.PRODUCTION_BASE_URL || "https://scorecaster.vercel.app").replace(/\/$/, "");
const targetSha = String(process.env.TARGET_SHA || "").trim().toLowerCase();
const cronSecret = String(process.env.CRON_SECRET || "");
const reportPath = process.env.POST_DEPLOY_CAPTURE_REPORT_PATH
  ? path.resolve(root, process.env.POST_DEPLOY_CAPTURE_REPORT_PATH)
  : null;
const waitSeconds = Math.max(30, Math.min(900, Number.parseInt(process.env.DEPLOYMENT_WAIT_SECONDS || "600", 10) || 600));
const pollSeconds = Math.max(5, Math.min(60, Number.parseInt(process.env.DEPLOYMENT_POLL_SECONDS || "15", 10) || 15));

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const finite = (value) => value === null || value === undefined || value === ""
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const clean = (value, maximum = 120) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

let parsedBase;
try {
  parsedBase = new URL(baseUrl);
} catch {
  console.error("Post-deploy capture requires a valid production URL.");
  process.exit(2);
}
if (parsedBase.protocol !== "https:" || parsedBase.host !== "scorecaster.vercel.app") {
  console.error("Post-deploy capture refuses a non-production host.");
  process.exit(2);
}
if (!/^[a-f0-9]{40}$/.test(targetSha)) {
  console.error("Post-deploy capture requires a full 40-character target SHA.");
  process.exit(2);
}
if (cronSecret.length < 16) {
  console.error("Post-deploy capture requires the protected worker secret in the Actions environment.");
  process.exit(2);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    ...options
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

const startedAt = Date.now();
const deadline = startedAt + waitSeconds * 1000;
let healthAttempts = 0;
let observedCommit = null;
let productionMatchedAt = null;

while (Date.now() <= deadline) {
  healthAttempts += 1;
  try {
    const { response, payload } = await fetchJson(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "application/json",
        "User-Agent": "Scorecaster-Post-Deploy-Evidence/1.0"
      }
    });
    observedCommit = clean(payload?.commit, 64).toLowerCase() || null;
    if (response.status === 200 && payload?.status === "ok" && observedCommit === targetSha) {
      productionMatchedAt = new Date().toISOString();
      break;
    }
    console.log(`[post-deploy-evidence] waiting for production commit target=${targetSha.slice(0, 8)} observed=${observedCommit?.slice(0, 8) || "unknown"}`);
  } catch {
    console.log(`[post-deploy-evidence] production health probe unavailable on attempt ${healthAttempts}; retrying`);
  }
  await sleep(pollSeconds * 1000);
}

if (!productionMatchedAt) {
  console.error(`[post-deploy-evidence] deployment wait expired after ${healthAttempts} health probes; worker was not invoked`);
  process.exit(1);
}

console.log(`[post-deploy-evidence] production commit ${targetSha.slice(0, 8)} confirmed; invoking unified-data worker once`);

let workerResponse;
let workerPayload;
try {
  const result = await fetchJson(`${baseUrl}/api/internal/unified-data`, {
    method: "GET",
    signal: AbortSignal.timeout(120_000),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${cronSecret}`,
      "User-Agent": "Scorecaster-Post-Deploy-Evidence/1.0"
    }
  });
  workerResponse = result.response;
  workerPayload = result.payload;
} catch {
  console.error("[post-deploy-evidence] unified-data worker request failed without a readable response; no retry was attempted");
  process.exit(1);
}

const report = {
  version: "scorecaster-post-deploy-unified-data-capture-v1",
  targetSha,
  productionMatchedAt,
  healthAttempts,
  worker: {
    httpStatus: workerResponse.status,
    ok: workerPayload?.ok === true,
    version: clean(workerPayload?.version, 100) || null,
    capturedAt: clean(workerPayload?.capturedAt, 64) || null,
    selections: finite(workerPayload?.selections),
    providerObservations: finite(workerPayload?.providerObservations),
    incidentsActive: finite(workerPayload?.incidents?.active),
    incidentsResolved: finite(workerPayload?.incidents?.resolved),
    closingFinalized: finite(workerPayload?.closingRecords?.finalized),
    paperOnly: workerPayload?.paperOnly === true
  },
  safety: {
    invocationCount: 1,
    workerRetried: false,
    credentialsRetained: false,
    authorizationHeaderRetained: false,
    rawWorkerResponseRetained: false,
    providerPayloadsRetained: false,
    userIdentifiersRetained: false,
    bookmakerCredentials: false,
    realMoneyExecution: false
  }
};

if (reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(report, null, 2));

if (workerResponse.status !== 200 || workerPayload?.ok !== true || workerPayload?.paperOnly !== true) {
  console.error(`[post-deploy-evidence] worker did not produce a valid paper-only capture (HTTP ${workerResponse.status})`);
  process.exit(1);
}
