import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(await readFile(path.join(root, "config/two-user-isolation.json"), "utf8"));
const reportPath = process.env.TWO_USER_ISOLATION_CONTRACT_REPORT_PATH
  ? path.resolve(root, process.env.TWO_USER_ISOLATION_CONTRACT_REPORT_PATH)
  : null;

const migrationCache = new Map();
const failures = [];
const tables = [];

async function migration(relativePath) {
  if (!migrationCache.has(relativePath)) {
    migrationCache.set(relativePath, await readFile(path.join(root, relativePath), "utf8"));
  }
  return migrationCache.get(relativePath);
}

function escaped(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasRls(source, table, mode) {
  return new RegExp(`alter\\s+table\\s+public\\.${escaped(table)}\\s+${mode}\\s+row\\s+level\\s+security`, "i").test(source);
}

function hasOwnerPolicy(source, table, ownerColumn) {
  const tableStart = source.toLowerCase().indexOf(`on public.${table.toLowerCase()}`);
  if (tableStart < 0) return false;
  const windows = [];
  let cursor = 0;
  while (cursor < source.length) {
    const found = source.toLowerCase().indexOf(`on public.${table.toLowerCase()}`, cursor);
    if (found < 0) break;
    windows.push(source.slice(Math.max(0, found - 220), Math.min(source.length, found + 420)));
    cursor = found + 1;
  }
  const owner = escaped(ownerColumn);
  return windows.some((window) => new RegExp(`auth\\.uid\\(\\)\\s*=\\s*${owner}|${owner}\\s*=\\s*auth\\.uid\\(\\)`, "i").test(window));
}

function hasAuthenticatedPrivilege(source, table, privilege) {
  const grants = [...source.matchAll(new RegExp(`grant\\s+([^;]+?)\\s+on(?:\\s+table)?\\s+public\\.${escaped(table)}\\s+to\\s+authenticated`, "gi"))]
    .map((match) => match[1].toLowerCase());
  return grants.some((grant) => grant.split(",").map((part) => part.trim()).includes(privilege.toLowerCase()));
}

function hasAuthenticatedRevoke(source, table, privilege) {
  const revokes = [...source.matchAll(new RegExp(`revoke\\s+([^;]+?)\\s+on(?:\\s+table)?\\s+public\\.${escaped(table)}\\s+from\\s+authenticated`, "gi"))]
    .map((match) => match[1].toLowerCase());
  return revokes.some((revoke) => revoke === "all" || revoke.split(",").map((part) => part.trim()).includes(privilege.toLowerCase()));
}

for (const table of matrix.tables || []) {
  const source = await migration(table.migration);
  const tableFailures = [];
  const rls = hasRls(source, table.table, "enable");
  const forceRls = hasRls(source, table.table, "force");
  const ownerPolicy = hasOwnerPolicy(source, table.table, table.ownerColumn);
  if (!rls) tableFailures.push("RLS not enabled");
  if (!forceRls) tableFailures.push("FORCE RLS not enabled");
  if (!ownerPolicy) tableFailures.push(`no auth.uid() ownership policy found for ${table.ownerColumn}`);

  for (const privilege of table.clientAccess || []) {
    if (!hasAuthenticatedPrivilege(source, table.table, privilege)) {
      tableFailures.push(`authenticated ${privilege} grant is missing`);
    }
  }

  for (const privilege of ["insert", "update", "delete"]) {
    if ((table.clientAccess || []).includes(privilege)) continue;
    const explicitlyRevoked = hasAuthenticatedRevoke(source, table.table, privilege)
      || new RegExp(`revoke\\s+all\\s+on(?:\\s+table)?\\s+public\\.${escaped(table.table)}\\s+from\\s+anon,\\s*authenticated`, "i").test(source);
    if (!explicitlyRevoked) tableFailures.push(`authenticated ${privilege} is not explicitly revoked`);
  }

  failures.push(...tableFailures.map((failure) => `${table.table}: ${failure}`));
  tables.push({
    table: table.table,
    category: table.category,
    ownerColumn: table.ownerColumn,
    migration: table.migration,
    rls,
    forceRls,
    ownerPolicy,
    clientAccess: table.clientAccess,
    passed: tableFailures.length === 0,
    failures: tableFailures
  });
}

const hardCapSource = await migration(matrix.hardCaps.migration);
const hardCaps = {
  triggerAuthority: /before\s+insert\s+or\s+update[^;]*on\s+public\.bets/i.test(hardCapSource),
  sameEventDuplicate: /already used this event during the UTC day/i.test(hardCapSource) && /v_duplicate_count\s*>\s*0/i.test(hardCapSource),
  maxAutonomousStakeFraction: /v_max_stake\s*:=\s*v_bankroll\s*\*\s*0\.01/i.test(hardCapSource),
  maxDailyPaperExposureFraction: /v_max_daily\s*:=\s*v_bankroll\s*\*\s*0\.05/i.test(hardCapSource),
  maxSameLeagueExposureFraction: /v_max_league\s*:=\s*v_bankroll\s*\*\s*0\.025/i.test(hardCapSource),
  sameLeagueScope: /coalesce\(league,\s*sport,\s*'unknown'\)\s*=\s*coalesce\(new\.league,\s*new\.sport,\s*'unknown'\)/i.test(hardCapSource),
  advisoryLock: /pg_advisory_xact_lock/i.test(hardCapSource),
  checkViolationSqlState: /errcode\s*=\s*'23514'/i.test(hardCapSource)
};
for (const [name, passed] of Object.entries(hardCaps)) {
  if (!passed) failures.push(`hard-cap:${name}: contract missing`);
}

const exportApi = await readFile(path.join(root, "app/api/account/export/route.js"), "utf8");
const deleteApi = await readFile(path.join(root, "app/api/account/route.js"), "utf8");
const apiChecks = {
  exportAuthenticated: /getAuthenticatedContext\(request,\s*\{\s*requireCsrf:\s*false\s*\}\)/s.test(exportApi),
  exportScopesQueriesToAuthenticatedUser: [
    /id=eq\.\$\{auth\.user\.id\}/,
    /user_id=eq\.\$\{auth\.user\.id\}/
  ].every((pattern) => pattern.test(exportApi)),
  exportAccountIdentityFromAuth: /id:\s*auth\.user\.id/.test(exportApi),
  deleteRequiresAuthenticatedContext: /getAuthenticatedContext\(request,\s*\{\s*requireCsrf:\s*true\s*\}\)/s.test(deleteApi),
  deleteScopesProfileToAuthenticatedUser: /\.eq\("id",\s*auth\.user\.id\)/.test(deleteApi),
  deleteScopesAuthUserToAuthenticatedUser: /deleteUser\(auth\.user\.id\)/.test(deleteApi),
  deleteClearsOnlyCurrentAuthCookies: /clearAuthCookies/.test(deleteApi)
};
for (const [name, passed] of Object.entries(apiChecks)) {
  if (!passed) failures.push(`account-api:${name}: contract missing`);
}

const report = {
  version: "scorecaster-two-user-isolation-contract-v1",
  generatedAt: new Date().toISOString(),
  matrixVersion: matrix.version,
  tableCount: tables.length,
  passedTables: tables.filter((table) => table.passed).length,
  failedTables: tables.filter((table) => !table.passed).length,
  tables,
  hardCaps,
  accountApis: apiChecks,
  passed: failures.length === 0,
  failures,
  limitations: {
    productionDatabaseProbed: false,
    bearerAccountsProbed: false,
    cookieAccountsProbed: false,
    destructiveDeleteProbed: false,
    hardCapsExecutedAgainstProduction: false
  },
  safety: {
    staticOnly: true,
    rawUserIdsIncluded: false,
    tokensIncluded: false,
    cookiesIncluded: false,
    passwordsIncluded: false,
    serviceRoleValueIncluded: false,
    realMoneyExecution: false,
    paperOnly: true
  }
};

if (reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (failures.length) {
  console.error("Scorecaster two-user isolation contract audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Scorecaster two-user isolation contract audit passed: ${tables.length}/${tables.length} user-owned tables plus database hard-cap and account API boundaries.`);
  console.log("Production two-user bearer/cookie probes and transactional hard-cap execution remain external evidence requirements.");
}
