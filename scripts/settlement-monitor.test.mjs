import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

test("settlement monitor migration isolates user state and atomically claims bounded work", async () => {
  const sql = await source("supabase/scorecaster_settlement_monitor.sql");
  assert.match(sql, /create table if not exists public\.paper_settlement_monitor_state/i);
  assert.match(sql, /references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /after insert or update or delete on public\.bets/i);
  assert.match(sql, /where user_id = v_user_id and status = 'open'/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /lease_expires_at = now\(\) \+ interval '10 minutes'/i);
  assert.match(sql, /next_check_at = now\(\) \+ interval '60 minutes'/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /grant execute on function public\.claim_paper_settlement_monitor_users\(integer\) to service_role/i);
  assert.match(sql, /grant execute on function public\.complete_paper_settlement_monitor_user/i);
});

test("worker shares bounded sport results and only updates still-open H2H paper bets", async () => {
  const worker = await source("lib/settlement-monitor.js");
  assert.match(worker, /MAX_USERS_PER_RUN = 20/);
  assert.match(worker, /MAX_OPEN_BETS_PER_USER = 100/);
  assert.match(worker, /MAX_SPORTS_PER_RUN = 12/);
  assert.match(worker, /MAX_SETTLEMENTS_PER_RUN = 200/);
  assert.match(worker, /chooseEntriesWithinSportBudget/);
  assert.match(worker, /loadScoreEvents\(sport, \{ fetchImpl \}\)/);
  assert.match(worker, /findScoreEventForBet/);
  assert.match(worker, /settlePaperBetFromScore/);
  assert.match(worker, /String\(bet\?\.market \|\| "h2h"\)\.toLowerCase\(\) === "h2h"/);
  assert.match(worker, /\.eq\("status", "open"\)/);
  assert.match(worker, /settlementMonitorVersion: "settlement-monitor-v1"/);
  assert.doesNotMatch(worker, /placeBet|bookmaker credential|withdrawal/i);
});

test("manual and background settlement use the same bounded score provider", async () => {
  const provider = await source("lib/paper-score-provider.js");
  const manualRoute = await source("app/api/cloud/bets/settle/route.js");
  assert.match(provider, /SCORE_TIMEOUT_MS = 12_000/);
  assert.match(provider, /SCORE_LOOKBACK_DAYS = 3/);
  assert.match(provider, /process\.env\.ODDS_API_KEY/);
  assert.match(provider, /https:\/\/api\.the-odds-api\.com\/v4\/sports/);
  assert.match(provider, /cache: "no-store"/);
  assert.match(manualRoute, /import \{ loadScoreEvents \} from/);
  assert.match(manualRoute, /checkedSports\.map\(\(sport\) => loadScoreEvents\(sport\)\)/);
  assert.doesNotMatch(manualRoute, /api\.the-odds-api\.com|URLSearchParams\(\{\s*apiKey/i);
});

test("internal settlement route is secret protected and fail closed", async () => {
  const route = await source("app/api/internal/settlement-monitor/route.js");
  const config = await source("lib/settlement-monitor-config.js");
  assert.match(config, /SCORECASTER_SETTLEMENT_MONITOR_DISABLED === "true"/);
  assert.match(config, /SCORECASTER_SETTLEMENT_MONITOR_ENABLED === "false"/);
  assert.match(config, /cronSecret\.length >= 16/);
  assert.match(config, /scoresProviderConfigured/);
  assert.match(config, /request\.headers\.get\("authorization"\) === `Bearer \$\{secret\}`/);
  assert.match(route, /settlementMonitorAuthorizationValid\(request\)/);
  assert.match(route, /Settlement Monitor is disabled/);
  assert.match(route, /getSupabaseAdminClient\(\)/);
  assert.match(route, /maxDuration = 60/);
  assert.doesNotMatch(route, /ODDS_API_KEY|SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET\s*:/);
});

test("scheduler runs settlement before autonomous paper decisions and Shadow Learning", async () => {
  const workflow = await source(".github/workflows/notification-delivery.yml");
  const settleStart = workflow.indexOf("  settle:");
  const autonomousStart = workflow.indexOf("  autonomous:");
  const shadowStart = workflow.indexOf("  shadow-learning:");
  const deliverStart = workflow.indexOf("  deliver:");
  assert.ok(settleStart >= 0 && autonomousStart > settleStart && shadowStart > autonomousStart && deliverStart > shadowStart);
  const settleBlock = workflow.slice(settleStart, autonomousStart);
  const autonomousBlock = workflow.slice(autonomousStart, shadowStart);
  const shadowBlock = workflow.slice(shadowStart, deliverStart);
  assert.match(settleBlock, /Run Settlement Monitor cycle/);
  assert.match(settleBlock, /\/api\/internal\/settlement-monitor/);
  assert.doesNotMatch(settleBlock, /needs:/);
  assert.doesNotMatch(settleBlock, /SCORECASTER_SETTLEMENT_MONITOR_ENABLED/);
  assert.match(settleBlock, /secrets\.CRON_SECRET/);
  assert.match(autonomousBlock, /needs: settle/);
  assert.match(shadowBlock, /needs: settle/);
  assert.match(shadowBlock, /SCORECASTER_SHADOW_LEARNING_ENABLED/);
  assert.match(shadowBlock, /\/api\/internal\/shadow-learning/);
  assert.match(workflow, /Authorization: Bearer \$\{CRON_SECRET\}/);
});

test("authenticated status, native UI, export and deletion cover monitor metadata", async () => {
  const statusRoute = await source("app/api/cloud/settlement-monitor/route.js");
  const mobile = await source("mobile/src/screens/PaperBetsScreen.tsx");
  const exportRoute = await source("app/api/account/export/route.js");
  const accountRoute = await source("app/api/account/route.js");
  assert.match(statusRoute, /getAuthenticatedContext\(request\)/);
  assert.match(statusRoute, /paper_settlement_monitor_state/);
  assert.match(statusRoute, /monitorActive: configuration\.monitorActive/);
  assert.doesNotMatch(statusRoute, /ODDS_API_KEY|SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET/);
  assert.match(mobile, /\/api\/cloud\/settlement-monitor/);
  assert.match(mobile, /Automatic result monitoring/);
  assert.match(exportRoute, /settlementMonitor:/);
  assert.match(exportRoute, /paper_settlement_monitor_state/);
  assert.ok(accountRoute.indexOf('"paper_settlement_monitor_state"') < accountRoute.indexOf('"bets"'));
  assert.match(accountRoute, /automatic settlement monitor state/);
});
