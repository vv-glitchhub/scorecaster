import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const internalTables = [
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

test("hardening migration is idempotent and fail closed", async () => {
  const sql = await source("scripts/apply-public-schema-hardening-v1.sql");
  assert.match(sql, /begin;/i);
  assert.match(sql, /commit;/i);
  assert.match(sql, /to_regclass/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all privileges .* from public, anon, authenticated/i);
  assert.match(sql, /grant all privileges .* to service_role/i);
  assert.match(sql, /notify pgrst, 'reload schema'/i);
  assert.doesNotMatch(executableSql(sql), /drop\s+(table|column)|truncate\s+table|delete\s+from/i);

  for (const table of internalTables) assert.match(sql, new RegExp(`'${table}'`));
});

test("only reviewed client grant matrices remain", async () => {
  const sql = await source("scripts/apply-public-schema-hardening-v1.sql");
  assert.match(sql, /grant select, insert, update, delete on table public\.bets to authenticated/i);
  assert.match(sql, /grant select, insert, update on table public\.user_settings to authenticated/i);
  assert.match(sql, /grant select on table public\.community_comments to anon, authenticated/i);
  assert.match(sql, /grant insert, update, delete on table public\.community_comments to authenticated/i);
  assert.doesNotMatch(executableSql(sql), /grant\s+(truncate|trigger|references)/i);
});

test("verification rejects missing RLS and dangerous client privileges", async () => {
  const sql = await source("scripts/verify-public-schema-hardening-v1.sql");
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /relforcerowsecurity/);
  assert.match(sql, /TRUNCATE/);
  assert.match(sql, /TRIGGER/);
  assert.match(sql, /REFERENCES/);
  assert.match(sql, /Internal tables still expose client privileges/);
  assert.match(sql, /anon must not read bets/);
  assert.match(sql, /public-schema-hardening-v1/);
  assert.match(sql, /paperOnly/);
});

test("server routes use service-role clients for affected internal tables", async () => {
  const valueBets = await source("app/api/value-bets/route.js");
  const feedback = await source("app/api/feedback/route.js");
  const track = await source("app/api/track/route.js");
  const supabase = await source("lib/supabase.js");
  assert.match(valueBets, /lib\/supabase/);
  assert.match(feedback, /supabaseAdmin/);
  assert.match(track, /supabaseAdmin/);
  assert.match(supabase, /SUPABASE_SERVICE_ROLE_KEY/);
});
