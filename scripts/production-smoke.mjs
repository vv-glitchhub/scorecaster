import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "config/release-readiness.json"), "utf8"));
const baseUrl = String(process.env.SCORECASTER_SMOKE_BASE_URL || process.argv[2] || manifest.productionBaseUrl).replace(/\/$/, "");
const accessToken = String(process.env.SCORECASTER_SMOKE_ACCESS_TOKEN || "").trim();
const reportPath = path.resolve(root, process.env.SCORECASTER_SMOKE_REPORT_PATH || "artifacts/production-smoke.json");
const invalidWorkerCredential = "Bearer scorecaster-intentionally-invalid-worker-probe";
const checks = [];
const failures = [];
const workerProbeEvidence = {};

function safeOrigin(value) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Smoke-test origin must use HTTPS unless it is localhost");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Smoke-test origin must not contain credentials, query parameters or fragments");
  }
  return url.origin;
}

function record(name, ok, details = {}) {
  const entry = { name, ok, ...details };
  checks.push(entry);
  if (!ok) failures.push(entry);
}

function secretFree(value) {
  return !/(SUPABASE_SERVICE_ROLE_KEY|ODDS_API_KEY|CRON_SECRET|OPENAI_API_KEY|AGENT_DECISION_SIGNING_KEY|expo_push_token|token_hash|sb_secret_|Bearer\s+[A-Za-z0-9_-]{24,})/i.test(String(value || ""));
}

async function request(route, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12_000);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: options.accept || "application/json, text/html;q=0.9",
        "User-Agent": "Scorecaster-Production-Smoke/2",
        ...(options.authorization ? { Authorization: options.authorization } : {})
      },
      method: options.method || "GET"
    });
    const body = await response.text();
    return {
      response,
      body,
      durationMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timeout);
  }
}

safeOrigin(baseUrl);

for (const route of manifest.publicPages) {
  try {
    const { response, body, durationMs } = await request(route, { accept: "text/html" });
    const finalOrigin = new URL(response.url).origin;
    const html = String(response.headers.get("content-type") || "").includes("text/html");
    const headersOk = Object.entries(manifest.requiredSecurityHeaders).every(([key, expected]) => response.headers.get(key) === expected);
    record(`public:${route}`, response.status === 200 && html && finalOrigin === baseUrl && headersOk && secretFree(body), {
      status: response.status,
      durationMs,
      finalUrl: response.url,
      contentType: response.headers.get("content-type") || null,
      securityHeaders: headersOk
    });
  } catch (error) {
    record(`public:${route}`, false, { error: error instanceof Error ? error.message : "Request failed" });
  }
}

try {
  const { response, body, durationMs } = await request("/api/health");
  let payload = null;
  try { payload = JSON.parse(body); } catch { payload = null; }
  const cacheControl = String(response.headers.get("cache-control") || "").toLowerCase();
  record("api:health", [200, 503].includes(response.status) && payload?.app === "Scorecaster" && payload?.productBoundary && cacheControl.includes("no-store") && secretFree(body), {
    status: response.status,
    durationMs,
    appStatus: payload?.status || null,
    deployment: payload?.deployment || null,
    commit: payload?.commit || null
  });
} catch (error) {
  record("api:health", false, { error: error instanceof Error ? error.message : "Health request failed" });
}

try {
  const { response, body, durationMs } = await request("/api/top-picks?view=summary", { timeoutMs: 30_000 });
  let payload = null;
  try { payload = JSON.parse(body); } catch { payload = null; }
  const sample = payload?.featured?.[0] || payload?.data?.[0] || null;
  const oversizedAuditKeys = [
    "featureEngineV1",
    "unifiedSportsData",
    "intelligenceFusionV2",
    "modelFactoryV1"
  ];
  const compact = !sample || oversizedAuditKeys.every((key) => !(key in sample));
  const byteLength = Buffer.byteLength(body, "utf8");
  record("api:top-picks-summary", response.status === 200 && payload?.view === "summary" && compact && byteLength <= 150_000 && secretFree(body), {
    status: response.status,
    durationMs,
    byteLength,
    pickCount: Array.isArray(payload?.data) ? payload.data.length : null,
    compact
  });
} catch (error) {
  record("api:top-picks-summary", false, { error: error instanceof Error ? error.message : "Top Picks summary request failed" });
}

for (const endpoint of manifest.protectedApis) {
  try {
    const { response, body, durationMs } = await request(endpoint.path, { method: endpoint.method });
    record(`unauthenticated:${endpoint.method}:${endpoint.path}`, endpoint.allowedStatuses.includes(response.status) && secretFree(body), {
      status: response.status,
      durationMs
    });
  } catch (error) {
    record(`unauthenticated:${endpoint.method}:${endpoint.path}`, false, { error: error instanceof Error ? error.message : "Request failed" });
  }
}

for (const endpoint of manifest.internalWorkers) {
  const observedAt = new Date().toISOString();
  let unauthenticated = null;
  let invalidCredential = null;

  try {
    const result = await request(endpoint.path, { method: endpoint.method });
    const ok = endpoint.allowedStatuses.includes(result.response.status) && secretFree(result.body);
    unauthenticated = { ok, status: result.response.status, durationMs: result.durationMs };
    record(`worker-guard:none:${endpoint.method}:${endpoint.path}`, ok, {
      status: result.response.status,
      durationMs: result.durationMs
    });
  } catch (error) {
    unauthenticated = { ok: false, status: null, durationMs: null, error: error instanceof Error ? error.message : "Request failed" };
    record(`worker-guard:none:${endpoint.method}:${endpoint.path}`, false, { error: unauthenticated.error });
  }

  try {
    const result = await request(endpoint.path, { method: endpoint.method, authorization: invalidWorkerCredential });
    const ok = endpoint.allowedStatuses.includes(result.response.status) && secretFree(result.body);
    invalidCredential = { ok, status: result.response.status, durationMs: result.durationMs };
    record(`worker-guard:invalid:${endpoint.method}:${endpoint.path}`, ok, {
      status: result.response.status,
      durationMs: result.durationMs
    });
  } catch (error) {
    invalidCredential = { ok: false, status: null, durationMs: null, error: error instanceof Error ? error.message : "Request failed" };
    record(`worker-guard:invalid:${endpoint.method}:${endpoint.path}`, false, { error: invalidCredential.error });
  }

  const passed = Boolean(unauthenticated?.ok && invalidCredential?.ok);
  workerProbeEvidence[endpoint.path] = {
    status: passed ? "passed" : "failed",
    observedAt,
    httpStatus: unauthenticated?.status ?? null,
    invalidCredentialHttpStatus: invalidCredential?.status ?? null,
    unauthenticatedDurationMs: unauthenticated?.durationMs ?? null,
    invalidCredentialDurationMs: invalidCredential?.durationMs ?? null,
    workerInvokedByProbe: false,
    validCredentialUsed: false
  };
}

if (accessToken) {
  for (const route of ["/api/operations", "/api/cloud/bets"]) {
    try {
      const { response, body, durationMs } = await request(route, { authorization: `Bearer ${accessToken}` });
      record(`authenticated:${route}`, response.status === 200 && secretFree(body), {
        status: response.status,
        durationMs
      });
    } catch (error) {
      record(`authenticated:${route}`, false, { error: error instanceof Error ? error.message : "Authenticated request failed" });
    }
  }
}

const report = {
  version: 2,
  product: "Scorecaster",
  baseUrl,
  generatedAt: new Date().toISOString(),
  authenticatedProbesEnabled: Boolean(accessToken),
  workerProbeMode: "guard-only-no-valid-cron-secret",
  workerProbeEvidence,
  passed: failures.length === 0,
  totals: {
    checks: checks.length,
    passed: checks.filter((item) => item.ok).length,
    failed: failures.length,
    workerGuards: Object.keys(workerProbeEvidence).length,
    workerGuardsPassed: Object.values(workerProbeEvidence).filter((item) => item.status === "passed").length
  },
  safety: {
    validCronSecretUsed: false,
    workerInvokedByGuardProbe: false,
    paperRowsCreatedByGuardProbe: false,
    realMoneyExecution: false
  },
  checks
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (failures.length) {
  console.error(`Scorecaster production smoke failed: ${failures.length}/${checks.length} checks failed.`);
  failures.forEach((item) => console.error(`- ${item.name}: ${item.status || item.error || "failed"}`));
  process.exitCode = 1;
} else {
  console.log(`Scorecaster production smoke passed: ${checks.length} checks against ${baseUrl}.`);
  console.log(`Protected-worker guard evidence passed: ${report.totals.workerGuardsPassed}/${report.totals.workerGuards}. No valid cron secret was used by guard probes.`);
  if (!accessToken) console.log("Authenticated user probes were skipped because SCORECASTER_SMOKE_ACCESS_TOKEN was not provided.");
}
