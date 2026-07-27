import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const action = String(process.env.SCORECASTER_ACTIVATION_ACTION || process.argv[2] || "schema").trim().toLowerCase();
const databaseUrl = String(process.env.SCORECASTER_PRODUCTION_DB_URL || "").trim();
const cronSecret = String(process.env.SCORECASTER_CRON_SECRET || "");
const baseUrl = String(process.env.SCORECASTER_ACTIVATION_BASE_URL || "https://scorecaster.vercel.app").replace(/\/$/, "");
const reportPath = path.resolve(root, process.env.SCORECASTER_COLLECTOR_ACTIVATION_REPORT_PATH || "artifacts/collector-production-activation.json");

const report = {
  version: "collector-production-activation-v1",
  action,
  startedAt: new Date().toISOString(),
  status: "running",
  schemaVerified: false,
  worker: null,
  health: null,
  error: null
};

function clean(value, limit = 500) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSchemaVerification() {
  assert(/^(postgres|postgresql):\/\//i.test(databaseUrl), "Collector production database URL is missing or invalid");
  const result = spawnSync("psql", [
    `--dbname=${databaseUrl}`,
    "--no-psqlrc",
    "--set=ON_ERROR_STOP=1",
    "--set=VERBOSITY=terse",
    "--file=scripts/verify-collector-schema.sql"
  ], { cwd: root, encoding: "utf8", env: { ...process.env, PGCONNECT_TIMEOUT: "15" }, stdio: ["ignore", "pipe", "pipe"] });
  if (result.error?.code === "ENOENT") throw new Error("PostgreSQL client psql is not installed");
  if (result.status !== 0) throw new Error(`Collector schema verification failed: ${clean(result.stderr, 800)}`);
  report.schemaVerified = true;
}

async function parse(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: clean(text, 300) || "Non-JSON response" }; }
}

async function probeCollector() {
  assert(/^https:\/\//i.test(baseUrl), "Collector production origin must use HTTPS");
  assert(cronSecret.length >= 16, "Collector worker secret is missing or too short");
  const workerResponse = await fetch(`${baseUrl}/api/internal/collector`, {
    headers: { accept: "application/json", authorization: `Bearer ${cronSecret}` },
    cache: "no-store",
    signal: AbortSignal.timeout(90_000)
  });
  const workerPayload = await parse(workerResponse);
  report.worker = {
    status: workerResponse.status,
    ok: workerResponse.ok && workerPayload?.ok !== false,
    version: clean(workerPayload?.version, 100),
    recordsStored: Number(workerPayload?.recordsStored || 0),
    error: clean(workerPayload?.error, 300) || null
  };
  assert(report.worker.ok, "Collector protected worker did not complete successfully");

  const healthResponse = await fetch(`${baseUrl}/api/collector/health`, {
    headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(30_000)
  });
  const healthPayload = await parse(healthResponse);
  report.health = {
    status: healthResponse.status,
    ok: healthPayload?.status === "healthy",
    collectorStatus: clean(healthPayload?.status, 80),
    migrationActive: Boolean(healthPayload?.migrationActive),
    error: clean(healthPayload?.error, 300) || null
  };
  assert(report.health.ok, "Collector health endpoint is not healthy after worker probe");
}

async function save() {
  report.completedAt = new Date().toISOString();
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

try {
  assert(["schema", "migrate", "probe"].includes(action), "Collector activation action must be schema, migrate or probe");
  if (action === "schema" || action === "migrate") runSchemaVerification();
  if (action === "probe") await probeCollector();
  report.status = "success";
  console.log(`Scorecaster Collector production activation ${action} completed successfully.`);
} catch (error) {
  report.status = "failure";
  report.error = clean(error?.message || error, 500);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await save();
}
