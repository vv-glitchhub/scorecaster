import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isSupabaseServiceRestricted,
  restrictedSupabaseResponse,
  assertSupabaseRestReachable,
  SUPABASE_SERVICE_RESTRICTED_CODE
} from "../lib/supabase-service-restriction.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("Supabase 402 is classified across status, HTTP code and PostgREST message", () => {
  for (const error of [
    { status: 402 }, { statusCode: "402" }, { code: 402 },
    { message: "402 Payment Required" }, { message: "Project service restriction" },
    { code: "exceeded_db_size_quota" }, { code: "overdue_payment" },
    { details: "Fair Use Policy service is restricted" }
  ]) {
    assert.equal(isSupabaseServiceRestricted(error), true, JSON.stringify(error));
  }
  for (const error of [null, undefined, {}, { code: "42P01", message: "relation does not exist" }, { status: 401 }, { message: "connection timed out" }, { status: 500 }]) {
    assert.equal(isSupabaseServiceRestricted(error), false, JSON.stringify(error));
  }
});

test("restricted response never exposes credentials or claims healthy data", () => {
  const result = restrictedSupabaseResponse("Unified Data");
  assert.equal(SUPABASE_SERVICE_RESTRICTED_CODE, "supabase-service-restricted");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, SUPABASE_SERVICE_RESTRICTED_CODE);
  assert.equal(result.releaseState, "blocked");
  assert.equal(result.retryableWithoutConfigurationChange, false);
  assert.equal(result.paperOnly, true);
  assert.doesNotMatch(JSON.stringify(result), /api[_-]?key|service[_-]?role|bearer|authorization/i);
});

test("availability preflight is a single lightweight HEAD read and fails closed", async () => {
  const calls = [];
  const client = { from(table) {
    calls.push(["from", table]);
    return { select(column, options) {
      calls.push(["select", column, options]);
      return { limit(n) { calls.push(["limit", n]); return Promise.resolve({ error: null }); } };
    } };
  }};
  await assertSupabaseRestReachable(client, "unified_data_snapshots");
  assert.deepEqual(calls, [
    ["from", "unified_data_snapshots"],
    ["select", "id", { head: true }],
    ["limit", 1]
  ]);

  const restricted = { status: 402, message: "Payment Required" };
  await assert.rejects(
    assertSupabaseRestReachable({
      from() { return { select() { return { limit() { return Promise.resolve({ error: restricted }); } }; } }; }
    }, "sports_analytics_snapshots"),
    (error) => error === restricted
  );
  await assert.rejects(
    assertSupabaseRestReachable({
      from() { return { select() { return { limit() { return Promise.resolve({ status: 402, error: null }); } }; } }; }
    }, "unified_data_snapshots"),
    (error) => error?.status === 402
  );
});

test("protected workers reject unauthorized requests before the quota preflight", async () => {
  for (const path of [
    "app/api/internal/unified-data/route.js",
    "app/api/internal/sports-analytics/route.js"
  ]) {
    const handler = (await read(path)).split("export async function GET(request) {")[1];
    assert.ok(handler, path);
    const guard = handler.indexOf("if (!authorized(request))");
    const preflight = handler.indexOf("await assertSupabaseRestReachable(admin");
    assert.ok(guard >= 0 && preflight > guard, path);
    assert.match(handler, /isSupabaseServiceRestricted\(error\)/);
    assert.match(handler, /restrictedSupabaseResponse\(/);
  }
});

test("collector and settlement keep HTTP 402 classified without leaking details", async () => {
  for (const path of [
    "app/api/internal/collector/route.js",
    "app/api/internal/settlement-monitor/route.js"
  ]) {
    const source = await read(path);
    assert.match(source, /isSupabaseServiceRestricted\(error\)/);
    assert.match(source, /restrictedSupabaseResponse\(/);
    assert.match(source, /\b503\b/);
  }
});

test("public freshness and production evidence fail closed on Supabase 402", async () => {
  const freshness = await read("app/api/unified-data/freshness/route.js");
  const evidence = await read("app/api/production-evidence/route.js");
  const collector = await read("app/api/collector/health/route.js");
  assert.match(freshness, /captureBlocked: true/);
  assert.match(freshness, /fresh: false/);
  assert.match(freshness, /protectedWorkerRequired: false/);
  assert.match(evidence, /restrictedSupabaseResponse\("Production evidence"\)/);
  assert.match(collector, /status: "restricted"/);
  for (const route of [freshness,evidence,collector]) assert.match(route, /503/);
});

test("freshness-aware cron skips protected worker for explicit quota restrictions, not arbitrary failures", async () => {
  for (const path of [".github/workflows/unified-data-capture.yml", ".github/workflows/collector.yml"]) {
    const source = await read(path);
    assert.match(source, /supabase-service-restricted/);
    assert.match(source, /required=true/);
    assert.match(source, /if \[ "\$status" = "200" \]/);
    assert.match(source, /api\/unified-data\/freshness/);
  }
});

test("Today reports restricted history separately from verified live odds", async () => {
  const today = await read("app/components/TodayPageV3.jsx");
  const client = await read("lib/client-request.mjs");
  assert.match(today, /data-storage-restriction="true"/);
  assert.match(today, /dataStorageError\?\.code === "supabase-service-restricted"/);
  assert.match(today, /\/"api\/unified-data\/freshness"/);
  assert.match(client, /error\?\.code === "supabase-service-restricted"/);
  assert.match(client, /model storage are restricted/);
});
