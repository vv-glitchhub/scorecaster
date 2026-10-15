import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("market microstructure checks cron auth, provider permissions and activation before quota preflight", async () => {
  const worker = await source("app/api/internal/market-microstructure/route.js");
  const handler = worker.split("export async function GET(request) {")[1];
  assert.ok(handler);
  const authorized = handler.indexOf("if (!authorized(request))");
  const sourcePermission = handler.indexOf("sourceCanCollect(source");
  const activation = handler.indexOf("resolveMarketMicrostructureActivation()");
  const preflight = handler.indexOf("await assertSupabaseRestReachable(admin");
  const fetchUpstream = handler.indexOf("fetchLeague(request, sport, markets)");
  assert.ok(authorized >= 0 && authorized < sourcePermission);
  assert.ok(sourcePermission < activation && activation < preflight);
  assert.ok(preflight < fetchUpstream);
  assert.match(worker, /assertSupabaseRestReachable\(admin, "market_capture_runs_v2"\)/);
  assert.match(worker, /if \(Number\(status\) === 402\) throw \{ status: 402 \}/);
});

test("quota restriction is a redacted 503 rather than a successful or altered model decision", async () => {
  const worker = await source("app/api/internal/market-microstructure/route.js");
  assert.match(worker, /isSupabaseServiceRestricted\(error\)/);
  assert.match(worker, /restrictedSupabaseResponse\("Market microstructure capture"\)/);
  assert.match(worker, /rawPayloadStored: false, probabilityChanged: false/);
  assert.match(worker, /realMoneyExecution: false/);
  assert.match(worker, /\}, 503\)/);
  assert.match(worker, /splitCaptureWindow/);
  assert.match(worker, /keepSupportedMarkets/);
});

test("scheduled market capture distinguishes quota outages without hiding other failures", async () => {
  const workflow = await source(".github/workflows/market-microstructure.yml");
  assert.match(workflow, /payload\?\.errorCode === 'supabase-service-restricted'/);
  assert.match(workflow, /restricted && code === 503/);
  assert.match(workflow, /const baseSafe = code === 200/);
  assert.match(workflow, /if \(!baseSafe\) process\.exit\(1\)/);
  assert.doesNotMatch(workflow, /cat .*response\.json/);
});

test("storage audit uses real pg_stat_user_indexes columns and remains non-destructive", async () => {
  const sql = await source("docs/operations/supabase-storage-audit.sql");
  assert.match(sql, /indexrelname AS index_name/);
  assert.match(sql, /relname AS table_name/);
  assert.match(sql, /date_trunc\('week', captured_at\)/);
  assert.doesNotMatch(sql, /\b(?:DROP|DELETE|TRUNCATE|REINDEX|VACUUM FULL)\s+(?:FROM\s+)?(?:TABLE\s+)?public\./i);
  assert.match(sql, /idx_scan=0 is NOT permission/);
});
