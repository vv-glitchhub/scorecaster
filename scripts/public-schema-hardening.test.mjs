import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

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

function executableSql(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

test("hardening migration is idempotent, fail closed and relation-kind aware", async () => {
  const sql = await source("scripts/apply-public-schema-hardening-v1.sql");
  assert.match(sql, /begin;/i);
  assert.match(sql, /commit;/i);
  assert.match(sql, /to_regclass/);
  assert.match(sql, /select c\.relkind/i);
  assert.match(sql, /target_kind in \('r', 'p'\)/i);
  assert.match(sql, /target_kind in \('v', 'm'\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all privileges .* from public, anon, authenticated/i);
  assert.match(sql, /grant all privileges .* to service_role/i);
  assert.match(sql, /grant select .* to service_role/i);
  assert.match(sql, /notify pgrst, 'reload schema'/i);
  assert.doesNotMatch(executableSql(sql), /drop\s+(table|column)|truncate\s+table|delete\s+from/i);
  assert.doesNotMatch(sql, /alter table public\.value_bets/i);

  for (const relation of internalRelations) assert.match(sql, new RegExp(`'${relation}'`));
});

test("reviewed client grants require matching existing RLS policies", async () => {
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
  assert.doesNotMatch(executableSql(sql), /grant\s+(truncate|trigger|references)/i);
});

test("verification checks RLS, PUBLIC exposure, service access and policy backing", async () => {
  const sql = await source("scripts/verify-public-schema-hardening-v1.sql");
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /relforcerowsecurity/);
  assert.match(sql, /c\.relkind in \('r', 'p'\)/i);
  assert.match(sql, /value_bets/);
  assert.match(sql, /TRUNCATE/);
  assert.match(sql, /TRIGGER/);
  assert.match(sql, /REFERENCES/);
  assert.match(sql, /PUBLIC table privileges remain/);
  assert.match(sql, /Internal relations still expose client privileges/);
  assert.match(sql, /service_role access is incomplete/);
  assert.match(sql, /grant lacks RLS policy backing/);
  assert.match(sql, /anon must not read bets/);
  assert.match(sql, /viewsProtectedByGrantRevocation/);
  assert.match(sql, /reviewedClientGrantsPolicyBacked/);
  assert.match(sql, /public-schema-hardening-v1\.2/);
  assert.match(sql, /paperOnly/);
});

test("server routes use server-side clients for affected internal relations", async () => {
  const valueBets = await source("app/api/value-bets/route.js");
  const feedback = await source("app/api/feedback/route.js");
  const track = await source("app/api/track/route.js");
  const supabase = await source("lib/supabase.js");
  assert.match(valueBets, /lib\/supabase/);
  assert.match(feedback, /supabaseAdmin/);
  assert.match(track, /supabaseAdmin/);
  assert.match(supabase, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("canonical release audit includes the public-schema repository gate", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  const gate = await source("scripts/public-schema-release-gate.mjs");
  assert.match(packageJson.scripts["release:audit"], /release-readiness\.mjs/);
  assert.match(packageJson.scripts["release:audit"], /public-schema-release-gate\.mjs/);
  assert.match(gate, /apply-public-schema-hardening-v1\.sql/);
  assert.match(gate, /verify-public-schema-hardening-v1\.sql/);
  assert.match(gate, /pg_policies/);
  assert.match(gate, /production Supabase/);
  assert.match(gate, /External verification still required/);
});
