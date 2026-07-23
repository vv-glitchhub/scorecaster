import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyAutonomousSystemCaps,
  buildAutonomousRiskGovernor,
  buildDailyPaperUsage
} from "../lib/autonomous-risk-governor.mjs";

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

test("worker v2 uses verified Top Picks, shadow learning and bounded paper-only decisions", async () => {
  const worker = await source("lib/autonomous-paper-agent-v2.js");
  assert.match(worker, /GET as getTopPicks/);
  assert.match(worker, /buildAgentV9Portfolio/);
  assert.match(worker, /applyModelLabSafety/);
  assert.match(worker, /buildSelfLearningReport/);
  assert.match(worker, /buildAutonomousRiskGovernor/);
  assert.match(worker, /MAX_USERS_PER_RUN = 10/);
  assert.match(worker, /MAX_SPORTS_PER_USER = 6/);
  assert.match(worker, /MAX_PICKS_PER_USER = 3/);
  assert.match(worker, /MAX_SAVED_PICKS_PER_RUN = 30/);
  assert.match(worker, /decision\.decision !== "PLAY"/);
  assert.match(worker, /event_already_exposed_today/);
  assert.match(worker, /database_risk_limit/);
  assert.match(worker, /scorecaster-autonomous-v2/);
  assert.match(worker, /decisionTicket: contextAudit/);
  assert.match(worker, /realMoneyBetting: false/);
  assert.doesNotMatch(worker, /bookmaker.*password|payment.*card|bank.*credential/i);
});

test("daily limits and exposure are enforced across worker runs", async () => {
  const worker = await source("lib/autonomous-paper-agent-v2.js");
  assert.match(worker, /\.gte\("created_at", dayStart\)/);
  assert.match(worker, /settings\.dailyPickLimit - daily\.pickCount/);
  assert.match(worker, /daily_pick_limit_reached/);
  assert.match(worker, /daily\.totalStake >= dailyCap/);
  assert.match(worker, /hardMaxStakePercent: 1/);
  assert.match(worker, /hardMaxDailyExposurePercent: 5/);
  assert.match(worker, /hardMaxLeagueExposurePercent: 2\.5/);

  const usage = buildDailyPaperUsage([
    { stake: 7.5, match: "A vs B", raw_pick: { source: "scorecaster-autonomous-v2", eventId: "event-a" } },
    { stake: 5, match: "C vs D", raw_pick: { source: "manual" } }
  ]);
  assert.equal(usage.pickCount, 1);
  assert.equal(usage.totalStake, 7.5);
  assert.equal(usage.events.has("event-a"), true);
});

test("risk governor caps stakes and pauses new exposure when paper performance becomes unsafe", () => {
  const capped = applyAutonomousSystemCaps({
    maxStakePercent: 4,
    maxTotalExposurePercent: 20,
    maxLeagueExposurePercent: 10
  });
  assert.equal(capped.maxStakePercent, 1);
  assert.equal(capped.maxTotalExposurePercent, 5);
  assert.equal(capped.maxLeagueExposurePercent, 2.5);

  const history = Array.from({ length: 6 }, (_, index) => ({
    id: `loss-${index}`,
    result: "loss",
    createdAt: new Date(Date.UTC(2026, 6, 23, 10 - index)).toISOString(),
    stake: 10,
    odds: 2,
    closingOdds: 1.9,
    modelProbability: 0.6
  }));
  const governor = buildAutonomousRiskGovernor(history);
  assert.equal(governor.mode, "paused");
  assert.equal(governor.allowNewExposure, false);
  assert.equal(governor.stakeMultiplier, 0);
  assert.ok(governor.hardReasons.includes("loss_streak_6"));
});

test("source and per-user failures are isolated, audited and retried", async () => {
  const worker = await source("lib/autonomous-paper-agent-v2.js");
  assert.match(worker, /const sourceFailures = new Map\(\)/);
  assert.match(worker, /recordSourceFailure/);
  assert.match(worker, /failureStage: "source_loading"/);
  assert.match(worker, /failureStage: "user_processing"/);
  assert.match(worker, /await finishRun\(admin, runId, failure/);
  assert.match(worker, /await completeUser\(admin, entry\.userId, failure\)/);
  assert.match(worker, /failedSourceGroups: sourceFailures\.size/);
});

test("autonomous paper rows are deterministic, auditable and database-risk guarded", async () => {
  const worker = await source("lib/autonomous-paper-agent-v2.js");
  const riskSql = await source("supabase/scorecaster_paper_risk_limits.sql");
  assert.match(worker, /createHash\("sha256"\)/);
  assert.match(worker, /autonomous-v2-\$\{day\}-\$\{digest\}/);
  assert.match(worker, /onConflict: "user_id,client_ref", ignoreDuplicates: true/);
  assert.match(worker, /status: "open"/);
  assert.match(worker, /usedDataSources/);
  assert.match(worker, /unusedOrMissingData/);
  assert.match(worker, /contextSignals/);
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
  assert.match(internal, /runAutonomousPaperAgentV2/);
  assert.match(internal, /Unauthorized/);
  assert.match(config, /cronSecret\.length >= 16/);
  assert.match(config, /secret\.length < 16/);
  assert.doesNotMatch(cloud, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|ODDS_API_KEY/);
});

test("scheduler is explicit opt-in and autonomous worker is independent", async () => {
  const workflow = await source(".github/workflows/notification-delivery.yml");
  assert.match(workflow, /SCORECASTER_AUTONOMOUS_AGENT_ENABLED == 'true'/);
  assert.match(workflow, /api\/internal\/autonomous-agent/);
  assert.match(workflow, /Run Autonomous Paper Agent cycle/);
  assert.match(workflow, /--max-time 55/);
  assert.doesNotMatch(workflow, /needs: autonomous/);
});

test("web console is trilingual and preserves the paper-only boundary", async () => {
  const client = await source("app/autonomous-agent/AutonomousAgentClient.jsx");
  const shell = await source("app/components/AppShell.jsx");
  assert.match(client, /fetch\("\/api\/cloud\/autonomous-agent"/);
  assert.match(client, /fi:/);
  assert.match(client, /en:/);
  assert.match(client, /es:/);
  assert.match(client, /Vain PLAY-päätös voidaan tallentaa/);
  assert.match(client, /Ei talletuksia/);
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
  assert.match(account, /"autonomous_agent_runs"/);
  assert.match(account, /"autonomous_agent_state"/);
  assert.match(account, /"autonomous_agent_settings"/);
  assert.match(manifest, /scorecaster_autonomous_agent\.sql/);
  assert.match(manifest, /api\/internal\/autonomous-agent/);
  assert.match(manifest, /api\/cloud\/autonomous-agent/);
});
