import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Supabase scheduler bridge is fail-closed and reuses protected workers", async () => {
  const route = await source("app/api/internal/collector/maintenance/route.js");
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /scorecaster_internal_secrets_v1/);
  assert.match(route, /production_data_pipeline_scheduler/);
  assert.match(route, /x-scorecaster-scheduler-token/);
  assert.match(route, /SCHEDULER_TASKS = new Map\(\[/);
  assert.match(route, /"collector"/);
  assert.match(route, /"unified-data"/);
  assert.match(route, /"sports-analytics"/);
  assert.match(route, /Authorization: `Bearer \$\{cronSecret\}`/);
  assert.match(route, /protectedWorkerRequired !== false/);
  assert.match(route, /status: "skipped-fresh"/);
  assert.match(route, /export async function POST/);
  assert.match(route, /paperOnly: true/);
  assert.doesNotMatch(route, /real[-_ ]?money/i);
});

test("production data scheduler has independent staggered pg_cron jobs", async () => {
  const sql = await source("supabase/scorecaster_own_model_scheduler_v1.sql");
  assert.match(sql, /production_data_pipeline_scheduler/);
  assert.match(sql, /trigger_production_data_pipeline_task/);
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /revoke all on function scorecaster_private\.trigger_production_data_pipeline_task\(text\) from public, anon, authenticated/);
  assert.match(sql, /scorecaster-production-collector-primary-v1/);
  assert.match(sql, /'2,32 \* \* \* \*'/);
  assert.match(sql, /scorecaster-production-unified-watchdog-v1/);
  assert.match(sql, /'7,22,37,52 \* \* \* \*'/);
  assert.match(sql, /scorecaster-production-sports-analytics-primary-v1/);
  assert.match(sql, /'12,42 \* \* \* \*'/);
  assert.match(sql, /https:\/\/scorecaster\.vercel\.app\/api\/internal\/collector\/maintenance\?task=/);
  assert.match(sql, /timeout_milliseconds := 120000/);
});

test("GitHub collector remains an independent fallback scheduler", async () => {
  const workflow = await source(".github/workflows/collector.yml");
  assert.match(workflow, /cron: "7,37 \* \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /secrets\.CRON_SECRET/);
  assert.match(workflow, /\/api\/internal\/collector/);
  assert.match(workflow, /\/api\/internal\/sports-analytics/);
  assert.match(workflow, /\/api\/collector\/health/);
});
