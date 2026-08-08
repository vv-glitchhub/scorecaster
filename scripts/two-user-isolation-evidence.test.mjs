import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const matrix = JSON.parse(await source("config/two-user-isolation.json"));

test("two-user matrix covers account, paper, watchlist, alerts, autonomous and shadow state", () => {
  assert.equal(matrix.version, 1);
  assert.equal(matrix.evidenceRules.rawUserIdsAllowed, false);
  assert.equal(matrix.evidenceRules.tokensAllowed, false);
  assert.equal(matrix.evidenceRules.cookiesAllowed, false);
  assert.equal(matrix.evidenceRules.serviceRoleValueAllowed, false);
  assert.equal(matrix.evidenceRules.passwordsAllowed, false);

  const tables = new Set(matrix.tables.map((item) => item.table));
  for (const table of [
    "profiles",
    "bankroll_settings",
    "bets",
    "watchlist_items",
    "alert_inbox",
    "autonomous_agent_settings",
    "autonomous_agent_state",
    "autonomous_agent_runs",
    "autonomous_agent_decision_audit",
    "shadow_learning_samples",
    "shadow_learning_state",
    "shadow_learning_cycles"
  ]) assert.ok(tables.has(table), `missing isolation table ${table}`);

  assert.equal(matrix.hardCaps.sameEventDuplicate, true);
  assert.equal(matrix.hardCaps.maxAutonomousStakeFraction, 0.01);
  assert.equal(matrix.hardCaps.maxDailyPaperExposureFraction, 0.05);
  assert.equal(matrix.hardCaps.maxSameLeagueExposureFraction, 0.025);
});

test("static contract audit checks RLS ownership, client grants, hard caps and current account scoping", async () => {
  const audit = await source("scripts/two-user-isolation-contract-audit.mjs");
  assert.match(audit, /function hasRls\(/);
  assert.match(audit, /hasRls\(source, table\.table, "enable"\)/);
  assert.match(audit, /hasRls\(source, table\.table, "force"\)/);
  assert.match(audit, /function hasOwnerPolicy\(/);
  assert.match(audit, /const ownerPolicy = hasOwnerPolicy/);
  assert.match(audit, /hasAuthenticatedPrivilege/);
  assert.match(audit, /hasAuthenticatedRevoke/);
  assert.match(audit, /v_max_stake/);
  assert.match(audit, /v_max_daily/);
  assert.match(audit, /v_max_league/);
  assert.match(audit, /pg_advisory_xact_lock/);
  assert.match(audit, /exportAuthenticated/);
  assert.match(audit, /deleteMutationOriginGuard/);
  assert.match(audit, /deleteScopesUserTablesToAuthenticatedUser/);
  assert.match(audit, /deleteScopesAuthUserToAuthenticatedUser/);
  assert.match(audit, /productionDatabaseProbed: false/);
  assert.match(audit, /rawUserIdsIncluded: false/);
});

test("safe production probe uses two bearer identities, optional cookie exports and no destructive mutations", async () => {
  const probe = await source("scripts/two-user-isolation-probe.mjs");
  assert.match(probe, /SCORECASTER_ISOLATION_USER_A_TOKEN/);
  assert.match(probe, /SCORECASTER_ISOLATION_USER_B_TOKEN/);
  assert.match(probe, /SCORECASTER_ISOLATION_USER_A_COOKIE/);
  assert.match(probe, /SCORECASTER_ISOLATION_USER_B_COOKIE/);
  assert.match(probe, /\/auth\/v1\/user/);
  assert.match(probe, /cross-user SELECT isolation failed/);
  assert.match(probe, /cross-user no-op update was not safely blocked/);
  assert.match(probe, /\/api\/account\/export/);
  assert.match(probe, /fingerprint\(userA\.id\)/);
  assert.match(probe, /fullIssueGatePassed: false/);
  assert.match(probe, /destructiveDeleteAttempted: false/);
  assert.match(probe, /crossUserInsertAttempted: false/);
  assert.match(probe, /tokensIncluded: false/);
  assert.match(probe, /cookiesIncluded: false/);
  assert.match(probe, /serviceRoleValueIncluded: false/);
  assert.doesNotMatch(probe, /console\.(?:log|error)\([^\n]*(?:tokenA|tokenB|cookieA|cookieB|publishableKey)/i);
});

test("transactional production probe is rollback-only and exercises destructive isolation plus hard caps", async () => {
  const sql = await source("scripts/two-user-isolation-transactional-probe.sql");
  assert.match(sql, /^begin;/mi);
  assert.match(sql, /set local role authenticated/i);
  assert.match(sql, /request\.jwt\.claim\.sub/);
  assert.match(sql, /select count\(\*\).*where %I = \$1/i);
  assert.match(sql, /update public\.%I set %I = %I where %I = \$1/i);
  assert.match(sql, /delete from public\.%I where %I = \$1/i);
  assert.match(sql, /when insufficient_privilege/i);
  assert.match(sql, /bankroll \* 0\.0101/);
  assert.match(sql, /bankroll \* 0\.045/);
  assert.match(sql, /bankroll \* 0\.0225/);
  assert.match(sql, /already used this event/);
  assert.match(sql, /5% bankroll/);
  assert.match(sql, /2\.5% bankroll/);
  assert.match(sql, /persistentRowsWritten', false/);
  assert.match(sql, /transactionOutcome', 'rollback'/);
  assert.match(sql, /rollback;\s*$/i);

  const executableSql = sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(executableSql, /bearer\s+[A-Za-z0-9._-]{20,}|service[_-]?role[_-]?key|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i);
});

test("account export and delete routes remain scoped to authenticated identity", async () => {
  const [exportRoute, accountRoute, security] = await Promise.all([
    source("app/api/account/export/route.js"),
    source("app/api/account/route.js"),
    source("lib/api-security.js")
  ]);

  assert.match(exportRoute, /export async function GET\(request\)/);
  assert.match(exportRoute, /getAuthenticatedContext\(request\)/);
  assert.doesNotMatch(exportRoute, /getAuthenticatedContext\(request,\s*\{[^}]*requireCsrf:\s*true/s);
  assert.match(exportRoute, /\.eq\("user_id",\s*auth\.user\.id\)/);
  assert.match(exportRoute, /\.eq\("id",\s*auth\.user\.id\)/);
  assert.match(exportRoute, /id:\s*auth\.user\.id/);

  assert.match(accountRoute, /export async function DELETE\(request\)/);
  assert.match(accountRoute, /mutationOriginAllowed\(request\)/);
  assert.match(accountRoute, /getAuthenticatedContext\(request\)/);
  assert.match(accountRoute, /\.eq\("user_id",\s*auth\.user\.id\)/);
  assert.match(accountRoute, /\.eq\("id",\s*auth\.user\.id\)/);
  assert.match(accountRoute, /deleteUser\(auth\.user\.id\)/);
  assert.match(security, /supabase\.auth\.getUser\(bearerToken\)/);
  assert.match(security, /supabase\.auth\.getUser\(\)/);
  assert.match(security, /createServerClient/);
});
