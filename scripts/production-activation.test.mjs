import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }
async function json(path) { return JSON.parse(await source(path)); }

test("production activation is manual, environment-gated and never scheduled", async () => {
  const workflow = await source(".github/workflows/production-activation.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bschedule:/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /SCORECASTER_PRODUCTION_DB_URL/);
  assert.match(workflow, /SCORECASTER_CRON_SECRET/);
  assert.match(workflow, /permissions:\s+contents: read/s);
  assert.match(workflow, /retention-days: 90/);
});

test("activation runner requires exact confirmations and supports only bounded actions", async () => {
  const runner = await source("scripts/production-activation.mjs");
  assert.match(runner, /new Set\(\["schema", "migrate", "probe"\]\)/);
  assert.match(runner, /VERIFY SCORECASTER PRODUCTION/);
  assert.match(runner, /APPLY SCORECASTER PRODUCTION MIGRATIONS/);
  assert.match(runner, /PROBE SCORECASTER PRODUCTION WORKERS/);
  assert.match(runner, /Confirmation must exactly match/);
  assert.match(runner, /realMoneyBetting: false/);
});

test("migration rollout follows the reviewed manifest and uses fail-fast transactions", async () => {
  const runner = await source("scripts/production-activation.mjs");
  const manifest = await json("config/release-readiness.json");
  assert.equal(manifest.supabaseMigrations.length, 15);
  assert.equal(manifest.supabaseMigrations[0], "supabase/scorecaster_schema.sql");
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_decision_diagnostics.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_unified_data.sql"));
  assert.equal(manifest.supabaseMigrations.at(-2), "supabase/scorecaster_autonomous_agent.sql");
  assert.equal(manifest.supabaseMigrations.at(-1), "supabase/scorecaster_autonomous_agent_v2.sql");
  assert.match(runner, /manifest\.supabaseMigrations/);
  assert.match(runner, /migrations\.length >= 15/);
  assert.match(runner, /--set=ON_ERROR_STOP=1/);
  assert.match(runner, /--single-transaction/);
  assert.match(runner, /verify-production-schema\.sql/);
  assert.match(runner, /sha256/);
});

test("schema verifier checks RLS, anonymous denial, V2 worker grants and database risk enforcement", async () => {
  const sql = await source("scripts/verify-production-schema.sql");
  const unified = await source("supabase/scorecaster_unified_data.sql");
  const autonomousV2 = await source("supabase/scorecaster_autonomous_agent_v2.sql");
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /relforcerowsecurity/);
  assert.match(sql, /pg_policies/);
  assert.match(sql, /has_table_privilege\('anon'/);
  assert.match(sql, /decision_diagnostic_snapshots/);
  assert.match(sql, /decision_diagnostic_alerts/);
  assert.match(sql, /autonomous_agent_decision_audit/);
  assert.match(sql, /autonomous_agent_daily_briefs/);
  assert.match(sql, /claim_watchlist_monitor_users/);
  assert.match(sql, /claim_paper_settlement_monitor_users/);
  assert.match(sql, /claim_autonomous_agent_users/);
  assert.match(sql, /complete_autonomous_agent_user_v2/);
  assert.match(sql, /request_autonomous_agent_run/);
  assert.match(sql, /bets_enforce_paper_stake_limit/);
  assert.match(sql, /autonomous_agent_settings_schedule/);
  assert.match(sql, /authenticated users must not delete Autonomous Agent settings directly/);
  assert.match(unified, /unified_data_snapshots/);
  assert.match(unified, /unified_data_provider_observations/);
  assert.match(unified, /unified_data_closing_records/);
  assert.match(unified, /unified_data_incidents/);
  assert.match(autonomousV2, /status in \('running', 'success', 'error', 'deferred', 'paused'\)/);
  assert.match(autonomousV2, /force row level security/);
  assert.match(autonomousV2, /service_role/);
});

test("protected worker probes are bounded and activation reports exclude credentials", async () => {
  const runner = await source("scripts/production-activation.mjs");
  for (const route of [
    "/api/internal/watchlist-monitor",
    "/api/internal/settlement-monitor",
    "/api/internal/autonomous-agent",
    "/api/internal/notification-delivery",
    "/api/internal/decision-diagnostics",
    "/api/internal/unified-data"
  ]) assert.match(runner, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(runner, /AbortSignal\.timeout\(60_000\)/);
  assert.match(runner, /unexpectedly contains the database connection string/);
  assert.match(runner, /unexpectedly contains the worker secret/);
  assert.doesNotMatch(runner, /console\.log\([^\n]*(databaseUrl|cronSecret)/);
});

test("production activation remains separate from recurring workers", async () => {
  const activation = await source(".github/workflows/production-activation.yml");
  const workers = await source(".github/workflows/notification-delivery.yml");
  const diagnostics = await source(".github/workflows/decision-diagnostics.yml");
  const unified = await source(".github/workflows/unified-data-capture.yml");
  assert.doesNotMatch(activation, /SCORECASTER_AUTONOMOUS_AGENT_ENABLED\s*==\s*'true'/);
  assert.match(workers, /SCORECASTER_AUTONOMOUS_AGENT_ENABLED == 'true'/);
  assert.match(workers, /api\/internal\/autonomous-agent/);
  assert.match(workers, /SCORECASTER_WATCHLIST_MONITOR_ENABLED == 'true'/);
  assert.match(workers, /SCORECASTER_SETTLEMENT_MONITOR_ENABLED == 'true'/);
  assert.match(workers, /SCORECASTER_NOTIFICATION_DELIVERY_ENABLED == 'true'/);
  assert.match(diagnostics, /cron: "12 \* \* \* \*"/);
  assert.match(unified, /cron: "17,47 \* \* \* \*"/);
  assert.match(unified, /\/api\/internal\/unified-data/);
});
