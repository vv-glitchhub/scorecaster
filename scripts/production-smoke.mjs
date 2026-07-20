import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "config/release-readiness.json"), "utf8"));
const baseUrl = String(process.env.SCORECASTER_SMOKE_BASE_URL || process.argv[2] || manifest.productionBaseUrl).replace(/\/$/, "");
const accessToken = String(process.env.SCORECASTER_SMOKE_ACCESS_TOKEN || "").trim();
const reportPath = path.resolve(root, process.env.SCORECASTER_SMOKE_REPORT_PATH || "artifacts/production-smoke.json");
const checks = [];
const failures = [];

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
  return !/(SUPABASE_SERVICE_ROLE_KEY|ODDS_API_KEY|CRON_SECRET|OPENAI_API_KEY|AGENT_DECISION_SIGNING_KEY|expo_push_token|token_hash|sb_secret_)/i.test(String(value || ""));
}

async function request(route, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: options.accept || "application/json, text/html;q=0.9",
        "User-Agent": "Scorecaster-Production-Smoke/1",
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
  try {
    const { response, body, durationMs } = await request(endpoint.path, { method: endpoint.method });
    record(`worker-guard:${endpoint.method}:${endpoint.path}`, endpoint.allowedStatuses.includes(response.status) && secretFree(body), {
      status: response.status,
      durationMs
    });
  } catch (error) {
    record(`worker-guard:${endpoint.method}:${endpoint.path}`, false, { error: error instanceof Error ? error.message : "Request failed" });
  }
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
  version: 1,
  product: "Scorecaster",
  baseUrl,
  generatedAt: new Date().toISOString(),
  authenticatedProbesEnabled: Boolean(accessToken),
  passed: failures.length === 0,
  totals: {
    checks: checks.length,
    passed: checks.filter((item) => item.ok).length,
    failed: failures.length
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
  if (!accessToken) console.log("Authenticated probes were skipped because SCORECASTER_SMOKE_ACCESS_TOKEN was not provided.");
}
