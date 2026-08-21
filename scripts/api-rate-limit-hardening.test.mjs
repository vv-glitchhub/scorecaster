import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("API rate limiting mutates counters only through the server service role", async () => {
  const apiSecurity = await source("lib/api-security.js");

  assert.match(apiSecurity, /getSupabaseAdmin/);
  assert.match(apiSecurity, /admin\.rpc\("consume_api_quota_for_user"/);
  assert.match(apiSecurity, /p_user_id:\s*auth\.user\.id/);
  assert.doesNotMatch(apiSecurity, /auth\.supabase\.rpc\("consume_api_quota"/);
});

test("quota SQL removes direct authenticated mutation and exposes only service-role execution", async () => {
  const sql = await source("supabase/scorecaster_api_rate_limits.sql");

  assert.match(sql, /drop function if exists public\.consume_api_quota\(text, integer, integer\)/i);
  assert.match(sql, /create or replace function public\.consume_api_quota_for_user/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all on function public\.consume_api_quota_for_user\([^;]+\) from authenticated/i);
  assert.match(sql, /grant execute on function public\.consume_api_quota_for_user\([^;]+\) to service_role/i);
  assert.doesNotMatch(sql, /grant execute on function public\.consume_api_quota\(text, integer, integer\) to authenticated/i);
});
