import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(await readFile(path.join(root, "config/two-user-isolation.json"), "utf8"));
const reportPath = path.resolve(root, process.env.SCORECASTER_ISOLATION_REPORT_PATH || "artifacts/two-user-isolation-safe-probe.json");

const supabaseUrl = String(process.env.SCORECASTER_ISOLATION_SUPABASE_URL || "").replace(/\/$/, "");
const publishableKey = String(process.env.SCORECASTER_ISOLATION_SUPABASE_PUBLISHABLE_KEY || "").trim();
const baseUrl = String(process.env.SCORECASTER_ISOLATION_BASE_URL || "").replace(/\/$/, "");
const tokenA = String(process.env.SCORECASTER_ISOLATION_USER_A_TOKEN || "").trim();
const tokenB = String(process.env.SCORECASTER_ISOLATION_USER_B_TOKEN || "").trim();
const cookieA = String(process.env.SCORECASTER_ISOLATION_USER_A_COOKIE || "").trim();
const cookieB = String(process.env.SCORECASTER_ISOLATION_USER_B_COOKIE || "").trim();

const failures = [];
const blockers = [];

function fingerprint(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function safeOrigin(value, label) {
  if (!value) throw new Error(`${label} is missing`);
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error(`${label} must use HTTPS unless it is localhost`);
  if (url.username || url.password || url.search || url.hash) throw new Error(`${label} must be an origin without credentials, query or fragment`);
  return url.origin;
}

function redactError(error) {
  return String(error?.message || error || "request failed")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}/g, "[redacted-jwt]")
    .slice(0, 240);
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { ...options, cache: "no-store", redirect: "error", signal: controller.signal });
    const text = await response.text();
    return { response, json: parseJson(text) };
  } finally {
    clearTimeout(timeout);
  }
}

function supabaseHeaders(token, extra = {}) {
  return {
    apikey: publishableKey,
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...extra
  };
}

async function authUser(token) {
  const { response, json } = await fetchText(`${supabaseUrl}/auth/v1/user`, { headers: supabaseHeaders(token) });
  if (response.status !== 200 || !json?.id) throw new Error(`Supabase auth identity failed with HTTP ${response.status}`);
  return { id: String(json.id) };
}

async function restSelect(token, table, ownerColumn, ownerId) {
  const query = new URLSearchParams({ select: ownerColumn, limit: "25" });
  query.set(ownerColumn, `eq.${ownerId}`);
  const { response, json } = await fetchText(`${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${query}`, { headers: supabaseHeaders(token) });
  return {
    status: response.status,
    rows: Array.isArray(json) ? json.length : null,
    ok: response.status === 200 && Array.isArray(json)
  };
}

async function restNoopUpdate(token, table, ownerColumn, targetId) {
  const query = new URLSearchParams();
  query.set(ownerColumn, `eq.${targetId}`);
  const { response, json } = await fetchText(`${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${query}`, {
    method: "PATCH",
    headers: supabaseHeaders(token, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }),
    body: JSON.stringify({ [ownerColumn]: targetId })
  });
  const returnedRows = Array.isArray(json) ? json.length : response.status === 204 ? 0 : null;
  const securityBlocked = (response.status === 200 || response.status === 204)
    ? returnedRows === 0
    : [401, 403, 404].includes(response.status);
  return { status: response.status, returnedRows, securityBlocked };
}

function exportContainsOnlyUser(payload, userId) {
  if (!payload || typeof payload !== "object") return false;
  if (String(payload?.account?.id || "") !== userId) return false;
  const objects = [payload.bankroll, payload.autonomousAgentSettings, payload.notificationPreferences].filter(Boolean);
  if (objects.some((row) => row.user_id && String(row.user_id) !== userId)) return false;
  const arrays = [payload.bets, payload.watchlist, payload.alertInbox, payload.autonomousAgentRuns, payload.autonomousAgentAudit, payload.shadowLearningSamples, payload.shadowLearningCycles].filter(Array.isArray);
  return arrays.every((rows) => rows.every((row) => !row?.user_id || String(row.user_id) === userId));
}

async function exportProbe({ mode, credential, expectedUserId }) {
  if (!baseUrl || !credential) return { mode, configured: false, passed: false, status: null, reason: "credential-or-base-url-missing" };
  const headers = { Accept: "application/json" };
  if (mode === "bearer") headers.Authorization = `Bearer ${credential}`;
  else headers.Cookie = credential;
  const { response, json } = await fetchText(`${baseUrl}/api/account/export`, { headers });
  const passed = response.status === 200 && json?.ok === true && exportContainsOnlyUser(json, expectedUserId);
  return { mode, configured: true, passed, status: response.status, reason: passed ? null : "export-scope-check-failed" };
}

let resolvedSupabase = null;
let resolvedBase = null;
try {
  resolvedSupabase = safeOrigin(supabaseUrl, "SCORECASTER_ISOLATION_SUPABASE_URL");
  if (baseUrl) resolvedBase = safeOrigin(baseUrl, "SCORECASTER_ISOLATION_BASE_URL");
} catch (error) {
  failures.push(redactError(error));
}

if (!publishableKey) blockers.push("publishable-key-missing");
if (!tokenA || !tokenB) blockers.push("two-bearer-test-users-required");
if (!resolvedBase) blockers.push("production-base-url-missing");
if (!cookieA || !cookieB) blockers.push("cookie-auth-evidence-missing");

let userA = null;
let userB = null;
if (!failures.length && publishableKey && tokenA && tokenB && resolvedSupabase) {
  try {
    [userA, userB] = await Promise.all([authUser(tokenA), authUser(tokenB)]);
    if (userA.id === userB.id) failures.push("test accounts A and B resolve to the same authenticated user");
  } catch (error) {
    failures.push(redactError(error));
  }
}

const tableEvidence = [];
if (userA && userB && userA.id !== userB.id) {
  for (const table of matrix.tables || []) {
    try {
      const [aOwn, bOwn, aReadsB, bReadsA] = await Promise.all([
        restSelect(tokenA, table.table, table.ownerColumn, userA.id),
        restSelect(tokenB, table.table, table.ownerColumn, userB.id),
        restSelect(tokenA, table.table, table.ownerColumn, userB.id),
        restSelect(tokenB, table.table, table.ownerColumn, userA.id)
      ]);
      const fixtureAvailable = bOwn.ok && bOwn.rows > 0 && aOwn.ok && aOwn.rows > 0;
      const selectIsolated = aReadsB.ok && aReadsB.rows === 0 && bReadsA.ok && bReadsA.rows === 0;
      let noopUpdate = { attempted: false, passed: null, status: null, returnedRows: null };

      if (table.crossUserSafeNoopUpdate && bOwn.ok && bOwn.rows > 0) {
        const result = await restNoopUpdate(tokenA, table.table, table.ownerColumn, userB.id);
        const bAfter = await restSelect(tokenB, table.table, table.ownerColumn, userB.id);
        const passed = result.securityBlocked && bAfter.ok && bAfter.rows === bOwn.rows;
        noopUpdate = { attempted: true, passed, status: result.status, returnedRows: result.returnedRows };
        if (!passed) failures.push(`${table.table}: cross-user no-op update was not safely blocked`);
      }

      if (!fixtureAvailable) blockers.push(`${table.table}:dedicated-fixtures-missing`);
      if (!selectIsolated) failures.push(`${table.table}: cross-user SELECT isolation failed`);
      tableEvidence.push({
        table: table.table,
        category: table.category,
        fixtureAvailable,
        ownRows: { a: aOwn.rows, b: bOwn.rows },
        crossSelect: {
          passed: selectIsolated,
          aReadsBRows: aReadsB.rows,
          bReadsARows: bReadsA.rows,
          aStatus: aReadsB.status,
          bStatus: bReadsA.status
        },
        crossNoopUpdate: noopUpdate
      });
    } catch (error) {
      failures.push(`${table.table}: ${redactError(error)}`);
      tableEvidence.push({ table: table.table, category: table.category, fixtureAvailable: false, error: "probe-request-failed" });
    }
  }
}

const accountExports = [];
if (userA && userB && resolvedBase) {
  for (const [label, tokenCredential, cookieCredential, user] of [
    ["A", tokenA, cookieA, userA],
    ["B", tokenB, cookieB, userB]
  ]) {
    try {
      const bearerResult = await exportProbe({ mode: "bearer", credential: tokenCredential, expectedUserId: user.id });
      accountExports.push({ user: label, ...bearerResult });
      if (!bearerResult.passed) failures.push(`account-export:${label}:bearer scope failed`);

      const cookieResult = await exportProbe({ mode: "cookie", credential: cookieCredential, expectedUserId: user.id });
      accountExports.push({ user: label, ...cookieResult });
      if (cookieResult.configured && !cookieResult.passed) failures.push(`account-export:${label}:cookie scope failed`);
    } catch (error) {
      failures.push(`account-export:${label}: ${redactError(error)}`);
    }
  }
}

const fixtureComplete = tableEvidence.length === (matrix.tables || []).length && tableEvidence.every((item) => item.fixtureAvailable);
const readIsolationPassed = tableEvidence.length > 0 && tableEvidence.every((item) => item.crossSelect?.passed === true);
const safeUpdatesPassed = tableEvidence.filter((item) => item.crossNoopUpdate?.attempted).every((item) => item.crossNoopUpdate.passed === true);
const bearerExportsPassed = accountExports.filter((item) => item.mode === "bearer").length === 2 && accountExports.filter((item) => item.mode === "bearer").every((item) => item.passed);
const cookieExportsPassed = accountExports.filter((item) => item.mode === "cookie" && item.configured).length === 2 && accountExports.filter((item) => item.mode === "cookie").every((item) => item.passed);

const safeProbePassed = failures.length === 0 && fixtureComplete && readIsolationPassed && safeUpdatesPassed && bearerExportsPassed && cookieExportsPassed;
const report = {
  version: "scorecaster-two-user-isolation-safe-probe-v1",
  generatedAt: new Date().toISOString(),
  phase: "read-and-noop-update",
  environment: {
    supabaseOriginConfigured: Boolean(resolvedSupabase),
    applicationOriginConfigured: Boolean(resolvedBase),
    publishableKeyConfigured: Boolean(publishableKey),
    bearerUsersConfigured: Boolean(tokenA && tokenB),
    cookieUsersConfigured: Boolean(cookieA && cookieB)
  },
  users: userA && userB ? {
    a: fingerprint(userA.id),
    b: fingerprint(userB.id),
    distinct: userA.id !== userB.id
  } : null,
  tableEvidence,
  accountExports,
  summary: {
    fixtureComplete,
    readIsolationPassed,
    safeNoopUpdatesPassed: safeUpdatesPassed,
    bearerExportsPassed,
    cookieExportsPassed,
    safeProbePassed,
    fullIssueGatePassed: false
  },
  blockers: [...new Set([
    ...blockers,
    "cross-user-insert-delete-require-transactional-evidence",
    "account-delete-requires-disposable-test-account",
    "database-hard-caps-require-transactional-execution-evidence"
  ])],
  failures,
  releaseEvidenceFragment: {
    gateId: "two-user-isolation",
    status: failures.length ? "failed" : "unverified",
    reason: failures.length ? "safe-two-user-probe-failed" : "safe-probe-does-not-cover-destructive-or-hard-cap-transactional-tests"
  },
  safety: {
    rawUserIdsIncluded: false,
    tokensIncluded: false,
    cookiesIncluded: false,
    publishableKeyIncluded: false,
    serviceRoleValueIncluded: false,
    passwordsIncluded: false,
    destructiveDeleteAttempted: false,
    crossUserInsertAttempted: false,
    updateValueChanged: false,
    realMoneyExecution: false,
    paperOnly: true
  }
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (failures.length) {
  console.error(`Scorecaster two-user safe isolation probe failed with ${failures.length} security failure(s).`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else if (!safeProbePassed) {
  console.log("Scorecaster two-user safe isolation probe is incomplete/unverified. Missing fixtures, cookie evidence or production inputs remain explicit in the report.");
} else {
  console.log(`Scorecaster two-user safe isolation probe passed its non-destructive phase across ${tableEvidence.length} user-owned tables.`);
  console.log("The full issue gate remains unverified until transactional INSERT/DELETE, disposable account deletion and database hard-cap execution evidence are retained.");
}
