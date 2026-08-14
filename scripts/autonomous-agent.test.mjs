import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("autonomous agent schema is opt-in, leased, RLS isolated and service-role claimed", async () => {
  const sql = await source("supabase/scorecaster_autonomous_agent.sql");
  assert.match(sql, /create table if not exists public\.autonomous_agent_settings/);
  assert.match(sql, /enabled boolean not null default false/);
  assert.match(sql, /daily_pick_limit between 1 and 3/);
  assert.match(sql, /cardinality\(sports\) <= 6/);
  assert.match(sql, /for update of state skip locked/);
  assert.match(sql, /lease_expires_at = now\(\) \+ interval '10 minutes'/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /auth\.uid\(\) = user_id/);
  assert.match(sql, /revoke delete on public\.autonomous_agent_settings from authenticated/);
  assert.match(sql, /grant select, insert, update on public\.autonomous_agent_settings to authenticated/);
  assert.match(sql, /grant execute on function public\.claim_autonomous_agent_users\(integer\) to service_role/);
  assert.match(sql, /grant execute on function public\.request_autonomous_agent_run\(\) to authenticated/);
});

test("worker uses verified Top Picks, V11 governance and bounded paper-only decisions", async () => {
  const worker = await source("lib/autonomous-paper-agent.js");
  assert.match(worker, /GET as getTopPicks/);
  assert.match(worker, /buildAgentV9Portfolio/);
  assert.match(worker, /applyModelLabSafety/);
  assert.match(worker, /buildSelfLearningReport/);
  assert.match(worker, /MAX_USERS_PER_RUN = 10/);
  assert.match(worker, /MAX_SPORTS_PER_USER = 6/);
  assert.match(worker, /MAX_PICKS_PER_USER = 3/);
  assert.match(worker, /MAX_SAVED_PICKS_PER_RUN = 30/);
  assert.match(worker, /decision\.decision !== "PLAY"/);
  assert.match(worker, /event_already_exposed/);
  assert.match(worker, /database_risk_limit/);
  assert.match(worker, /scorecaster-autonomous-v1/);
  assert.match(worker, /realMoneyBetting: false/);
  assert.doesNotMatch(worker, /bookmaker.*password|payment.*card|bank.*credential/i);
});

test("source and per-user failures are isolated, audited and retried", async () => {
  const worker = await source("lib/autonomous-paper-agent.js");
  assert.match(worker, /const sourceFailures = new Map\(\)/);
  assert.match(worker, /recordSourceFailure/);
  assert.match(worker, /failureStage: "source_loading"/);
  assert.match(worker, /failureStage: "user_processing"/);
  assert.match(worker, /await finishRun\(admin, runId, failure/);
  assert.match(worker, /await completeUser\(admin, entry\.userId, failure\)/);
  assert.match(worker, /failedSourceGroups: sourceFailures\.size/);
});

test("autonomous paper rows are deterministic and database-risk guarded", async () => {
  const worker = await source("lib/autonomous-paper-agent.js");
  const riskSql = await source("supabase/scorecaster_paper_risk_limits.sql");
  assert.match(worker, /createHash\("sha256"\)/);
  assert.match(worker, /autonomous-v1-\$\{day\}-\$\{digest\}/);
  assert.match(worker, /onConflict: "user_id,client_ref", ignoreDuplicates: true/);
  assert.match(worker, /status: "open"/);
  assert.match(riskSql, /v_source like 'scorecaster%'/);
  assert.match(riskSql, /Open paper exposure exceeds/);
  assert.match(riskSql, /Open paper league exposure exceeds/);
  assert.match(riskSql, /minimum edge/);
  assert.match(riskSql, /minimum confidence/);
});

test("cloud and internal routes fail closed and never expose worker credentials", async () => {
  const cloud = await source("app/api/cloud/autonomous-agent/route.js");
  const internal = await source("app/api/internal/autonomous-agent/route.js");
  const config = await source("lib/autonomous-agent-config.js");
  assert.match(cloud, /getAuthenticatedContext\(request\)/);
  assert.match(cloud, /mutationOriginAllowed\(request\)/);
  assert.match(cloud, /bucket: "autonomous_agent_run_request"/);
  assert.match(cloud, /request_autonomous_agent_run/);
  assert.match(internal, /maxDuration = 60/);
  assert.match(internal, /autonomousAgentAuthorizationValid/);
  assert.match(internal, /Unauthorized/);
  assert.match(config, /cronSecret\.length >= 16/);
  assert.match(config, /secret\.length < 16/);
  assert.match(config, /SCORECASTER_AUTONOMOUS_AGENT_DISABLED === "true"/);
  assert.match(config, /SCORECASTER_AUTONOMOUS_AGENT_ENABLED === "false"/);
  assert.doesNotMatch(cloud, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|ODDS_API_KEY/);
});

test("scheduler settles first and then runs the protected autonomous worker", async () => {
  const workflow = await source(".github/workflows/notification-delivery.yml");
  const settleStart = workflow.indexOf("  settle:");
  const autonomousStart = workflow.indexOf("  autonomous:");
  const shadowStart = workflow.indexOf("  shadow-learning:");
  assert.ok(settleStart >= 0 && autonomousStart > settleStart && shadowStart > autonomousStart);
  const autonomousBlock = workflow.slice(autonomousStart, shadowStart);
  assert.match(autonomousBlock, /needs: settle/);
  assert.match(autonomousBlock, /secrets\.CRON_SECRET/);
  assert.match(autonomousBlock, /SCORECASTER_PRODUCTION_URL \|\| 'https:\/\/scorecaster\.vercel\.app'/);
  assert.match(workflow, /api\/internal\/autonomous-agent/);
  assert.match(workflow, /Run Autonomous Paper Agent cycle/);
  assert.match(workflow, /--max-time 55/);
  assert.doesNotMatch(autonomousBlock, /SCORECASTER_AUTONOMOUS_AGENT_ENABLED/);
});

test("enabling the agent atomically bootstraps a conservative paper-only bankroll", async () => {
  const sql = await source("supabase/scorecaster_autonomous_agent_v2.sql");
  assert.match(sql, /create or replace function public\.schedule_autonomous_agent_for_user\(\)/i);
  assert.match(sql, /insert into public\.bankroll_settings/i);
  assert.match(sql, /new\.user_id, 1000, 1, 5, 2\.5, 0\.025, 0\.58, true/i);
  assert.match(sql, /on conflict \(user_id\) do nothing/i);
  assert.match(sql, /insert into public\.autonomous_agent_state/i);
  assert.match(sql, /where enabled = true/i);
  assert.doesNotMatch(sql, /real.money|bookmaker|payment|wallet/i);
});

test("public health exposes worker readiness without exposing credentials", async () => {
  const health = await source("app/api/health/route.js");
  assert.match(health, /autonomousAgentWorkerEnabled: autonomousAgent\.enabledFlag/);
  assert.match(health, /autonomousAgentWorkerActive: autonomousAgent\.agentActive/);
  assert.match(health, /settlementMonitorWorkerActive: settlementMonitor\.monitorActive/);
  assert.match(health, /autonomousAgentUserOptInRequired: true/);
  assert.match(health, /autonomousAgentPaperOnly: true/);
  assert.match(health, /autonomousAgentDefaultVirtualBankroll: 1000/);
  assert.match(health, /backgroundWorkerOrder: "settlement-before-autonomous"/);
  assert.doesNotMatch(health, /process\.env\.(CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY|ODDS_API_KEY)\s*[,}]/);
});

test("web console is trilingual and preserves the paper-only boundary", async () => {
  const client = await source("app/autonomous-agent/AutonomousAgentClient.jsx");
  const shell = await source("app/components/AppShell.jsx");
  assert.match(client, /fetch\("\/api\/cloud\/autonomous-agent"/);
  assert.match(client, /fi:/);
  assert.match(client, /en:/);
  assert.match(client, /es:/);
  assert.match(client, /Vain täydet portit läpäissyt PLAY voidaan tallentaa/);
  assert.match(client, /Ei talletuksia/);
  assert.match(client, /Hätäpysäytys/);
  assert.match(shell, /href: "\/autonomous-agent"/);
  assert.match(shell, /Autonomous Agent/);
});

test("operations, export, deletion and release manifest include autonomous audit data", async () => {
  const operations = await source("app/api/operations/route.js");
  const exportRoute = await source("app/api/account/export/route.js");
  const account = await source("app/api/account/route.js");
  const manifest = await source("config/release-readiness.json");
  for (const token of ["autonomous_agent_state", "autonomous_agent_settings", "autonomous_agent_runs", "autonomousAgentRuns24h"]) {
    assert.match(operations, new RegExp(token));
  }
  assert.match(exportRoute, /autonomousAgentSettings/);
  assert.match(exportRoute, /autonomousAgentRuns/);
  assert.match(exportRoute, /autonomousAgentDecisionAudit/);
  assert.match(account, /"autonomous_agent_runs"/);
  assert.match(account, /"autonomous_agent_state"/);
  assert.match(account, /"autonomous_agent_settings"/);
  assert.match(account, /"autonomous_agent_decision_audit"/);
  assert.match(manifest, /scorecaster_autonomous_agent\.sql/);
  assert.match(manifest, /scorecaster_autonomous_agent_v2\.sql/);
  assert.match(manifest, /api\/internal\/autonomous-agent/);
  assert.match(manifest, /api\/cloud\/autonomous-agent/);
});
