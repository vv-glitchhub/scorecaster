import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const action = String(process.env.SCORECASTER_ACTIVATION_ACTION || process.argv[2] || "schema").trim().toLowerCase();
const confirmation = String(process.env.SCORECASTER_ACTIVATION_CONFIRMATION || "").trim();
const databaseUrl = String(process.env.SCORECASTER_PRODUCTION_DB_URL || "").trim();
const cronSecret = String(process.env.SCORECASTER_CRON_SECRET || "");
const baseUrl = String(process.env.SCORECASTER_ACTIVATION_BASE_URL || "https://scorecaster.vercel.app").replace(/\/$/, "");
const reportPath = path.resolve(root, process.env.SCORECASTER_ACTIVATION_REPORT_PATH || "artifacts/production-activation.json");
const allowedActions = new Set(["schema", "migrate", "probe"]);
const expectedConfirmations = {
  schema: "VERIFY SCORECASTER PRODUCTION",
  migrate: "APPLY SCORECASTER PRODUCTION MIGRATIONS",
  probe: "PROBE SCORECASTER PRODUCTION WORKERS"
};

const report = {
  version: "production-activation-v1",
  action,
  productBoundary: "sports analysis, risk control and virtual paper tracking only",
  realMoneyBetting: false,
  startedAt: new Date().toISOString(),
  status: "running",
  migrations: [],
  schemaVerified: false,
  sportsAnalyticsVerified: false,
  autonomousV13HardCapsVerified: false,
  shadowLearningVerified: false,
  probes: [],
  health: null,
  error: null
};

function clean(value, maximum = 500) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function redact(value, maximum = 500) {
  let safe = String(value || "");
  if (databaseUrl) safe = safe.split(databaseUrl).join("[redacted-database-url]");
  if (cronSecret) safe = safe.split(cronSecret).join("[redacted-worker-secret]");
  return clean(safe, maximum);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validHttps(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validPostgresUrl(value) {
  return /^(postgres|postgresql):\/\//i.test(value) && value.length >= 24;
}

async function loadJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function fileDigest(relativePath) {
  const content = await readFile(path.join(root, relativePath));
  return createHash("sha256").update(content).digest("hex");
}

function runPsql(args, label) {
  const result = spawnSync(
    "psql",
    [
      `--dbname=${databaseUrl}`,
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=1",
      "--set=VERBOSITY=terse",
      ...args
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PGCONNECT_TIMEOUT: "15" },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  if (result.error?.code === "ENOENT") {
    throw new Error("PostgreSQL client psql is not installed");
  }
  if (result.status !== 0) {
    const detail = redact(result.stderr, 1000);
    throw new Error(`${label} failed${detail ? `: ${detail}` : ""}`);
  }
  return redact(result.stdout, 4000);
}

async function verifySchema() {
  runPsql(["--file=scripts/verify-production-schema.sql"], "Production schema verification");
  report.schemaVerified = true;
  report.shadowLearningVerified = true;
  runPsql(["--file=scripts/verify-sports-analytics-schema.sql"], "Sports Analytics schema verification");
  report.sportsAnalyticsVerified = true;
  runPsql(["--file=scripts/verify-autonomous-v13-hard-caps.sql"], "Autonomous V13 hard-cap verification");
  report.autonomousV13HardCapsVerified = true;
}

async function migrate() {
  const manifest = await loadJson("config/release-readiness.json");
  const migrations = Array.isArray(manifest.supabaseMigrations) ? manifest.supabaseMigrations : [];
  assert(migrations.length >= 19, "Release manifest does not contain the complete production rollout");

  for (const migration of migrations) {
    assert(/^supabase\/scorecaster_[a-z0-9_]+\.sql$/.test(migration), `Unexpected migration path: ${migration}`);
    const digest = await fileDigest(migration);
    runPsql(["--single-transaction", `--file=${migration}`], `Migration ${migration}`);
    report.migrations.push({ path: migration, sha256: digest, status: "applied" });
  }

  await verifySchema();
}

async function parseResponse(response) {
  const responseText = await response.text();
  try {
    return JSON.parse(responseText);
  } catch {
    return { ok: false, error: redact(responseText, 300) || "Non-JSON response" };
  }
}

async function probeWorkers() {
  assert(validHttps(baseUrl), "Production probe origin must use HTTPS");
  assert(cronSecret.length >= 16, "Protected worker probe secret is missing or too short");

  const healthResponse = await fetch(`${baseUrl}/api/health`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });
  const healthPayload = await parseResponse(healthResponse);
  report.health = {
    status: healthResponse.status,
    app: clean(healthPayload?.app, 80),
    deployment: clean(healthPayload?.deployment, 80),
    commit: clean(healthPayload?.commit, 80),
    timestamp: clean(healthPayload?.timestamp, 80)
  };
  assert(healthPayload?.app === "Scorecaster", "Production health endpoint did not identify Scorecaster");

  const workers = [
    "/api/internal/watchlist-monitor",
    "/api/internal/settlement-monitor",
    "/api/internal/autonomous-agent",
    "/api/internal/shadow-learning",
    "/api/internal/notification-delivery",
    "/api/internal/decision-diagnostics",
    "/api/internal/unified-data",
    "/api/internal/sports-analytics"
  ];

  for (const workerPath of workers) {
    const response = await fetch(`${baseUrl}${workerPath}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${cronSecret}`
      },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000)
    });
    const payload = await parseResponse(response);
    const probeOk = response.ok && payload?.ok !== false && payload?.skipped !== true;
    report.probes.push({
      path: workerPath,
      status: response.status,
      ok: probeOk,
      version: clean(payload?.version || payload?.result?.version, 100),
      error: probeOk ? null : clean(payload?.error || "Worker did not complete an active cycle", 300)
    });
    assert(probeOk, `${workerPath} did not complete an active protected production cycle`);
  }
}

async function saveReport() {
  report.completedAt = new Date().toISOString();
  const serialized = JSON.stringify(report, null, 2);
  assert(!databaseUrl || !serialized.includes(databaseUrl), "Activation report unexpectedly contains the database connection string");
  assert(!cronSecret || !serialized.includes(cronSecret), "Activation report unexpectedly contains the worker secret");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${serialized}\n`, "utf8");
}

try {
  assert(allowedActions.has(action), "Activation action must be schema, migrate or probe");
  assert(confirmation === expectedConfirmations[action], `Confirmation must exactly match: ${expectedConfirmations[action]}`);

  if (action === "schema" || action === "migrate") {
    assert(validPostgresUrl(databaseUrl), "Production PostgreSQL connection string is missing or invalid");
  }

  if (action === "schema") await verifySchema();
  if (action === "migrate") await migrate();
  if (action === "probe") await probeWorkers();

  report.status = "success";
  console.log(`Scorecaster production activation ${action} completed successfully.`);
} catch (error) {
  report.status = "failure";
  report.error = redact(error?.message || error, 500);
  console.error(`Scorecaster production activation ${action} failed: ${report.error}`);
  process.exitCode = 1;
} finally {
  await saveReport();
}
