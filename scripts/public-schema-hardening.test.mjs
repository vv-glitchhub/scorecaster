import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

// public-schema-hardening-v1.4 regression contract. The original V1.3 apply
// remains intentionally idempotent; V1.4 adds the server-owned quota boundary
// and corresponding read-only production verification.
const internalRelations = [
  "bankroll_entries", "bookmakers", "live_player_stats", "live_team_stats",
  "match_context", "match_context_snapshots", "match_model_outputs", "matches",
  "model_predictions", "odds_cache", "odds_market_cache", "odds_snapshots",
  "player_game_logs", "player_model_stats", "player_ratings", "player_status",
  "predictions", "rating_update_logs", "team_game_logs", "team_model_stats",
  "team_ratings", "team_stats", "teams", "ai_audit_trail", "ai_decisions",
  "ai_intelligence_events", "ai_top5", "analytics_events", "feedback_messages",
  "intelligence_items", "intelligence_reports", "value_bets"
];
const legacyUserOwned = ["bet_slips", "bet_slip_items", "tracked_bets", "pick_explanations", "agent_feedback", "risk_events"];
const authenticatedSecurityDefinerAllowlist = [
  "claim_notification_device(text,text,text,text)",
  "request_autonomous_agent_run()"
];

function executableSql(sql) {
  return sql.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
}

test("public-schema-hardening-v1.3 apply patch is transactional, idempotent and non-destructive", async () => {
  const sql = await source("scripts/apply-public-schema-hardening-v1.sql");
  assert.match(sql, /public-schema hardening V1\.3/i);
  assert.match(sql, /begin;/i);
  assert.match(sql, /commit;/i);
  assert.match(sql, /to_regclass/);
  assert.match(sql, /select c\.relkind/i);
  assert.match(sql, /target_kind in \('r', 'p'\)/i);
  assert.match(sql, /target_kind in \('v', 'm'\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /notify pgrst, 'reload schema'/i);
  assert.doesNotMatch(executableSql(sql), /drop\s+(table|column)|truncate\s+table|delete\s+from/i);
  for (const relation of internalRelations) assert.match(sql, new RegExp(`'${relation}'`));
});

test("V1.3 globally removes dangerous browser privileges and closes policyless RLS tables", async () => {
  const sql = await source("scripts/apply-public-schema-hardening-v1.sql");
  assert.match(sql, /revoke all privileges on all tables in schema public from public/i);
  assert.match(sql, /revoke truncate, references, trigger on table %I\.%I from anon, authenticated/i);
  assert.match(sql, /and not exists \(\s*select 1 from pg_policies/s);
  assert.match(sql, /revoke all privileges on table public\.%I from public, anon, authenticated/i);
  assert.match(sql, /grant all privileges on table public\.%I to service_role/i);
  assert.doesNotMatch(executableSql(sql), /grant\s+(truncate|trigger|references)/i);
});

test("profile and legacy user-owned grant matrices are explicit and policy-backed", async () => {
  const sql = await source("scripts/apply-public-schema-hardening-v1.sql");
  assert.match(sql, /drop policy if exists "Users insert own profile" on public\.profiles/i);
  assert.match(sql, /grant select, update on table public\.profiles to authenticated/i);
  assert.match(sql, /Public schema hardening refused: profiles lacks authenticated RLS policy backing/);
  for (const relation of legacyUserOwned) assert.match(sql, new RegExp(`'${relation}'`));
  assert.match(sql, /grant select, insert, update, delete on table public\.%I to authenticated/i);
  assert.match(sql, /Public schema hardening refused: % lacks authenticated RLS policy backing/);
});

test("current reviewed client grants remain exact and policy-backed", async () => {
  const sql = await source("scripts/apply-public-schema-hardening-v1.sql");
  assert.match(sql, /pg_policies/);
  assert.match(sql, /unnest\(p\.roles\)/);
  assert.match(sql, /Public schema hardening refused: bets lacks authenticated RLS policy backing/);
  assert.match(sql, /Public schema hardening refused: user_settings lacks authenticated RLS policy backing/);
  assert.match(sql, /Public schema hardening refused: community_comments lacks/);
  assert.match(sql, /grant select, insert, update, delete on table public\.bets to authenticated/i);
  assert.match(sql, /grant select, insert, update on table public\.user_settings to authenticated/i);
  assert.match(sql, /grant select on table public\.community_comments to anon, authenticated/i);
  assert.match(sql, /grant insert, update, delete on table public\.community_comments to authenticated/i);
});

test("SECURITY DEFINER functions default to service role with reviewed authenticated RPC exceptions", async () => {
  const sql = await source("scripts/apply-public-schema-hardening-v1.sql");
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /where n\.nspname = 'public'\s+and p\.prosecdef/s);
  assert.match(sql, /revoke all privileges on function %s from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function %s to service_role/i);
  for (const signature of authenticatedSecurityDefinerAllowlist) {
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll(",", ",\\s*");
    assert.match(sql.replaceAll(" ", ""), new RegExp(escaped.replaceAll("\\s*", "")));
  }
  assert.match(sql, /revoke all privileges on function public\.request_autonomous_agent_run\(\) from anon/i);
});

test("V1.4 verification covers global grants and the server-owned quota RPC", async () => {
  const sql = await source("scripts/verify-public-schema-hardening-v1.sql");
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /relforcerowsecurity/);
  assert.match(sql, /TRUNCATE/);
  assert.match(sql, /TRIGGER/);
  assert.match(sql, /REFERENCES/);
  assert.match(sql, /PUBLIC table privileges remain/);
  assert.match(sql, /Policyless RLS tables still expose client privileges/);
  assert.match(sql, /Internal relations still expose client privileges/);
  assert.match(sql, /service_role access is incomplete/);
  assert.match(sql, /legacy Users insert own profile policy remains/);
  assert.match(sql, /Anonymous SECURITY DEFINER execution remains/);
  assert.match(sql, /Unexpected authenticated SECURITY DEFINER execution remains/);
  assert.match(sql, /Legacy authenticated quota RPC still exists/);
  assert.match(sql, /Authenticated users can execute server-owned quota RPC/);
  assert.match(sql, /public-schema-hardening-v1\.4/);
  assert.match(sql, /reviewedClientGrantsPolicyBacked/);
  assert.match(sql, /apiQuotaMutation/);
  assert.match(sql, /paperOnly/);
  for (const signature of authenticatedSecurityDefinerAllowlist) assert.match(sql, new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("server routes use server-owned quota mutation and reviewed authenticated user RPCs", async () => {
  const valueBets = await source("app/api/value-bets/route.js");
  const feedback = await source("app/api/feedback/route.js");
  const track = await source("app/api/track/route.js");
  const apiSecurity = await source("lib/api-security.js");
  const notifications = await source("app/api/cloud/notifications/route.js");
  const autonomous = await source("app/api/cloud/autonomous-agent/route.js");
  const supabase = await source("lib/supabase.js");
  assert.match(valueBets, /lib\/supabase/);
  assert.match(feedback, /supabaseAdmin/);
  assert.match(track, /supabaseAdmin/);
  assert.match(supabase, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(apiSecurity, /getSupabaseAdmin/);
  assert.match(apiSecurity, /rpc\("consume_api_quota_for_user"/);
  assert.match(apiSecurity, /p_user_id:\s*auth\.user\.id/);
  assert.match(notifications, /rpc\("claim_notification_device"/);
  assert.match(autonomous, /rpc\("request_autonomous_agent_run"/);
});

test("canonical release audit includes the public-schema repository gate", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  const gate = await source("scripts/public-schema-release-gate.mjs");
  assert.match(packageJson.scripts["release:audit"], /release-readiness\.mjs/);
  assert.match(packageJson.scripts["release:audit"], /public-schema-release-gate\.mjs/);
  assert.match(gate, /apply-public-schema-hardening-v1\.sql/);
  assert.match(gate, /verify-public-schema-hardening-v1\.sql/);
  assert.match(gate, /public-schema-hardening-v1\.4/);
  assert.match(gate, /SECURITY DEFINER/);
  assert.match(gate, /production Supabase/);
  assert.match(gate, /External verification still required/);
});
