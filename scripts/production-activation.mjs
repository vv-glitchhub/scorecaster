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
    throw new Error(`${label} failed; inspect the protected workflow log for the database error`);
  }
  return clean(result.stdout, 4000);
}

async function verifySchema() {
  runPsql(["--file=scripts/verify-production-schema.sql"], "Production schema verification");
  report.schemaVerified = true;
}

async function migrate() {
  const manifest = await loadJson("config/release-readiness.json");
  const migrations = Array.isArray(manifest.supabaseMigrations) ? manifest.supabaseMigrations : [];
  assert(migrations.length >= 12, "Release manifest does not contain the complete production rollout");

  for (const migration of migrations) {
    assert(/^supabase\/scorecaster_[a-z0-9_]+\.sql$/.test(migration), `Unexpected migration path: ${migration}`);
    const digest = await fileDigest(migration);
    runPsql(["--single-transaction", `--file=${migration}`], `Migration ${migration}`);
    report.migrations.push({ path: migration, sha256: digest, status: "applied" });
  }

  await verifySchema();
}

async function parseResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: clean(text, 300) || "Non-JSON response" };
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

  const workers = [
    "/api/internal/watchlist-monitor",
    "/api/internal/settlement-monitor",
    "/api/internal/autonomous-agent",
    "/api/internal/notification-delivery"
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
    report.probes.push({
      path: workerPath,
      status: response.status,
      ok: response.ok && payload?.ok !== false,
      version: clean(payload?.version, 100),
      error: response.ok ? null : clean(payload?.error, 300)
    });
    assert(response.ok, `${workerPath} did not accept the protected production probe`);
  }
}

async function saveReport() {
  report.completedAt = new Date().toISOString();
  const serialized = JSON.stringify(report, null, 2);
  assert(!serialized.includes(databaseUrl), "Activation report unexpectedly contains the database connection string");
  assert(!serialized.includes(cronSecret) || cronSecret.length === 0, "Activation report unexpectedly contains the worker secret");
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
  report.error = clean(error?.message || error, 500);
  console.error(`Scorecaster production activation ${action} failed: ${report.error}`);
  process.exitCode = 1;
} finally {
  await saveReport();
}
