import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

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
  assert.match(workflow, /collector-production-activation\.mjs/);
  assert.match(workflow, /collector-production-activation\.json/);
  assert.match(workflow, /permissions:\s+contents: read/s);
  assert.match(workflow, /retention-days: 90/);
});

test("activation runner requires exact confirmations and supports only bounded actions", async () => {
  const runner = await source("scripts/production-activation.mjs");
  const collectorRunner = await source("scripts/collector-production-activation.mjs");
  assert.match(runner, /new Set\(\["schema", "migrate", "probe"\]\)/);
  assert.match(runner, /VERIFY SCORECASTER PRODUCTION/);
  assert.match(runner, /APPLY SCORECASTER PRODUCTION MIGRATIONS/);
  assert.match(runner, /PROBE SCORECASTER PRODUCTION WORKERS/);
  assert.match(runner, /Confirmation must exactly match/);
  assert.match(runner, /realMoneyBetting: false/);
  assert.match(collectorRunner, /collector-production-activation-v1/);
  assert.match(collectorRunner, /\["schema", "migrate", "probe"\]/);
});

test("migration rollout follows the reviewed manifest and uses fail-fast transactions", async () => {
  const runner = await source("scripts/production-activation.mjs");
  const manifest = await json("config/release-readiness.json");
  const discoveredMigrations = (await readdir(new URL("../supabase/", import.meta.url)))
    .filter((name) => /^scorecaster_[a-z0-9_]+\.sql$/.test(name))
    .map((name) => "supabase/" + name)
    .sort();
  assert.deepEqual([...manifest.supabaseMigrations].sort(), discoveredMigrations);
  assert.equal(new Set(manifest.supabaseMigrations).size, manifest.supabaseMigrations.length);
  assert.deepEqual(manifest.productionPatches, [
    "scripts/apply-market-microstructure-v2.sql",
    "scripts/apply-calibration-lab-v1.sql",
    "scripts/apply-ai-coach-v1.sql",
    "scripts/apply-verified-live-monitor-v1.sql"
  ]);
  assert.equal(manifest.supabaseMigrations[0], "supabase/scorecaster_schema.sql");
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_decision_diagnostics.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_agent_decision_signing_vault.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_collector_v1.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_community_feed_v1.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_ai_intelligence_v1.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_unified_data.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_sports_analytics.sql"));
  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_autonomous_agent_risk_profile_v1.sql"));
  assert.ok(manifest.supabaseMigrations.indexOf("supabase/scorecaster_agent_decision_signing_vault.sql") < manifest.supabaseMigrations.indexOf("supabase/scorecaster_collector_v1.sql"));
  assert.ok(manifest.supabaseMigrations.indexOf("supabase/scorecaster_collector_v1.sql") < manifest.supabaseMigrations.indexOf("supabase/scorecaster_unified_data.sql"));
  const shadowLearningIndex = manifest.supabaseMigrations.indexOf("supabase/scorecaster_shadow_learning_v1.sql");
  assert.deepEqual(manifest.supabaseMigrations.slice(shadowLearningIndex + 1, shadowLearningIndex + 7), [
    "supabase/scorecaster_shadow_candidate_observations_v1.sql",
    "supabase/scorecaster_shadow_candidate_settlement_batch_v1.sql",
    "supabase/scorecaster_shadow_candidate_trigger_safety_v1.sql",
    "supabase/scorecaster_shadow_candidate_settlement_batch_v1_fix.sql",
    "supabase/scorecaster_shadow_candidate_function_acl_v1.sql",
    "supabase/scorecaster_shadow_candidate_settlement_performance_v2.sql"
  ]);
  assert.deepEqual(manifest.supabaseMigrations.slice(-2), [
    "supabase/scorecaster_authenticated_rpc_boundaries_v1.sql",
    "supabase/scorecaster_pg_net_extension_schema_v1.sql"
  ]);
  assert.match(runner, /manifest\.supabaseMigrations/);
  assert.match(runner, /manifest\.productionPatches/);
  assert.match(runner, /readdir\(path\.join\(root, "supabase"\)\)/);
  assert.match(runner, /does not contain every repository Scorecaster migration/);
  assert.match(runner, /--set=ON_ERROR_STOP=1/);
  assert.match(runner, /--single-transaction/);
  assert.match(runner, /verify-production-schema\.sql/);
  assert.match(runner, /verify-sports-analytics-schema\.sql/);
  assert.match(runner, /verify-autonomous-v13-hard-caps\.sql/);
  assert.match(runner, /verify-shadow-candidate-schema\.sql/);
  assert.match(runner, /sportsAnalyticsVerified/);
  assert.match(runner, /verify-market-microstructure-v2\.sql/);
  assert.match(runner, /verify-calibration-lab-v1\.sql/);
  assert.match(runner, /verify-ai-coach-v1\.sql/);
  assert.match(runner, /verify-verified-live-monitor-v1\.sql/);
  assert.match(runner, /sha256/);
});

test("schema verifiers check RLS, Collector, Sports Analytics, V13 hard caps, Shadow Learning and database risk enforcement", async () => {
  const sql = await source("scripts/verify-production-schema.sql");
  const collectorVerification = await source("scripts/verify-collector-schema.sql");
  const collectorMigration = await source("supabase/scorecaster_collector_v1.sql");
  const sportsVerification = await source("scripts/verify-sports-analytics-schema.sql");
  const hardCapVerification = await source("scripts/verify-autonomous-v13-hard-caps.sql");
  const hardCapMigration = await source("supabase/scorecaster_autonomous_v13_hard_caps.sql");
  const unified = await source("supabase/scorecaster_unified_data.sql");
  const sportsAnalytics = await source("supabase/scorecaster_sports_analytics.sql");
  const autonomousV2 = await source("supabase/scorecaster_autonomous_agent_v2.sql");
  const autonomousRisk = await source("supabase/scorecaster_autonomous_agent_risk_profile_v1.sql");
  const shadow = await source("supabase/scorecaster_shadow_learning_v1.sql");
  const schema = await source("supabase/scorecaster_schema.sql");
  const auth = await source("supabase/scorecaster_auth_cloud.sql");
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /relforcerowsecurity/);
  assert.match(sql, /pg_policies/);
  assert.match(sql, /has_table_privilege\('anon'/);
  assert.match(sql, /decision_diagnostic_snapshots/);
  assert.match(sql, /decision_diagnostic_alerts/);
  assert.match(sql, /autonomous_agent_decision_audit/);
  assert.match(sql, /autonomous_agent_daily_briefs/);
  assert.match(sql, /shadow_learning_samples/);
  assert.match(sql, /shadow_learning_state/);
  assert.match(sql, /shadow_learning_cycles/);
  assert.match(await source("scripts/verify-shadow-candidate-schema.sql"), /shadow_candidate_settlement_runs_v1/);
  assert.match(sql, /claim_watchlist_monitor_users/);
  assert.match(sql, /claim_paper_settlement_monitor_users/);
  assert.match(sql, /claim_autonomous_agent_users/);
  assert.match(sql, /complete_autonomous_agent_user_v2/);
  assert.match(sql, /claim_shadow_learning_users/);
  assert.match(sql, /complete_shadow_learning_user/);
  assert.match(sql, /sync_shadow_learning_sample/);
  assert.match(sql, /request_autonomous_agent_run/);
  assert.match(sql, /bets_enforce_paper_stake_limit/);
  assert.match(sql, /bets_capture_shadow_learning/);
  assert.match(sql, /autonomous_agent_settings_schedule/);
  assert.match(autonomousRisk, /risk_profile/);
  assert.match(autonomousRisk, /risk_policy/);
  assert.match(autonomousRisk, /schedule_autonomous_agent_for_user/);
  assert.match(sql, /authenticated users must not delete Autonomous Agent settings directly/);
  assert.match(collectorMigration, /collector_runs/);
  assert.match(collectorMigration, /collector_records/);
  assert.match(collectorMigration, /force row level security/);
  assert.match(collectorVerification, /collector_runs/);
  assert.match(collectorVerification, /collector_records/);
  assert.match(collectorVerification, /has_table_privilege\('anon'/);
  assert.match(unified, /unified_data_snapshots/);
  assert.match(unified, /unified_data_provider_observations/);
  assert.match(unified, /unified_data_closing_records/);
  assert.match(unified, /unified_data_incidents/);
  assert.match(sportsAnalytics, /sports_analytics_snapshots/);
  assert.match(sportsAnalytics, /sports_analytics_observations/);
  assert.match(sportsAnalytics, /force row level security/);
  assert.match(sportsVerification, /sports_analytics_snapshots/);
  assert.match(sportsVerification, /sports_analytics_observations/);
  assert.match(sportsVerification, /directClientAccessDisabled/);
  assert.match(sportsVerification, /paperOnly/);
  assert.match(autonomousV2, /status in \('running', 'success', 'error', 'deferred', 'paused'\)/);
  assert.match(autonomousV2, /force row level security/);
  assert.match(autonomousV2, /service_role/);
  assert.match(hardCapMigration, /v_bankroll \* 0\.01/);
  assert.match(hardCapMigration, /v_bankroll \* 0\.05/);
  assert.match(hardCapMigration, /v_bankroll \* 0\.025/);
  assert.match(hardCapMigration, /date_trunc\('day'/);
  assert.match(hardCapMigration, /already used this event/);
  assert.match(hardCapVerification, /bets_enforce_autonomous_v13_hard_caps/);
  assert.match(hardCapVerification, /authenticated users must not execute/);
  assert.match(shadow, /production_probability_changed = false/);
  assert.match(shadow, /automatic_promotion_allowed = false/);
  assert.match(shadow, /real_money_execution = false/);
  assert.match(shadow, /on conflict \(user_id, bet_id\) do update set/);
  assert.match(schema, /add column if not exists tracked_bet_id/);
  assert.match(schema, /legacy-odds-snapshot/);
  assert.match(auth, /add column if not exists profit/);
  assert.match(auth, /data_type = 'jsonb'/);
  assert.match(unified, /truncate, references, trigger/);
  assert.match(unified, /from public/);
});

test("protected worker probes are bounded and activation reports exclude credentials", async () => {
  const runner = await source("scripts/production-activation.mjs");
  const collectorRunner = await source("scripts/collector-production-activation.mjs");
  for (const route of [
    "/api/internal/watchlist-monitor",
    "/api/internal/settlement-monitor",
    "/api/internal/autonomous-agent",
    "/api/internal/shadow-learning",
    "/api/internal/shadow-candidate-settlement",
    "/api/internal/notification-delivery",
    "/api/internal/decision-diagnostics",
    "/api/internal/unified-data",
    "/api/internal/sports-analytics"
  ]) assert.match(runner, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(collectorRunner, /\/api\/internal\/collector/);
  assert.match(collectorRunner, /\/api\/collector\/health/);
  assert.match(runner, /130_000 : 60_000/);
  assert.match(collectorRunner, /AbortSignal\.timeout\(90_000\)/);
  assert.match(runner, /autonomousV13HardCapsVerified/);
  assert.match(runner, /sportsAnalyticsVerified/);
  assert.match(runner, /shadowLearningVerified/);
  assert.match(runner, /shadowCandidateSettlementVerified/);
  assert.match(runner, /unexpectedly contains the database connection string/);
  assert.match(runner, /unexpectedly contains the worker secret/);
  assert.doesNotMatch(runner, /console\.log\([^\n]*(databaseUrl|cronSecret)/);
});

test("production activation remains separate from recurring workers", async () => {
  const activation = await source(".github/workflows/production-activation.yml");
  const workers = await source(".github/workflows/notification-delivery.yml");
  const diagnostics = await source(".github/workflows/decision-diagnostics.yml");
  const unified = await source(".github/workflows/unified-data-capture.yml");
  const collector = await source(".github/workflows/collector.yml");
  assert.doesNotMatch(activation, /SCORECASTER_AUTONOMOUS_AGENT_ENABLED\s*==\s*'true'/);
  assert.doesNotMatch(workers, /SCORECASTER_AUTONOMOUS_AGENT_ENABLED == 'true'/);
  assert.match(workers, /api\/internal\/autonomous-agent/);
  assert.match(workers, /SCORECASTER_SHADOW_LEARNING_ENABLED == 'true'/);
  assert.match(workers, /api\/internal\/shadow-learning/);
  assert.match(workers, /SCORECASTER_WATCHLIST_MONITOR_ENABLED == 'true'/);
  assert.doesNotMatch(workers, /SCORECASTER_SETTLEMENT_MONITOR_ENABLED == 'true'/);
  assert.match(workers, /autonomous:\s+needs: settle/);
  assert.match(workers, /secrets\.CRON_SECRET/);
  assert.match(workers, /SCORECASTER_NOTIFICATION_DELIVERY_ENABLED == 'true'/);
  assert.match(diagnostics, /cron: "12 \* \* \* \*"/);
  assert.match(unified, /cron: "17,47 \* \* \* \*"/);
  assert.match(unified, /\/api\/internal\/unified-data/);
  assert.match(unified, /\/api\/internal\/sports-analytics/);
  assert.match(collector, /cron: "7,37 \* \* \* \*"/);
  assert.match(collector, /\/api\/internal\/collector/);
  assert.match(collector, /\/api\/collector\/health/);
});
