import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("./apply-production-db-performance-v1.sql", import.meta.url);

async function migration() {
  return readFile(migrationUrl, "utf8");
}

function executableSql(sql) {
  return String(sql || "").replace(/^\s*--.*$/gm, "");
}

const FK_INDEXES = [
  ["ai_audit_trail", "decision_id"],
  ["autonomous_agent_decision_audit", "saved_bet_id"],
  ["bankroll_entries", "match_id"],
  ["bet_slip_items", "bet_slip_id"],
  ["collector_records", "run_id"],
  ["live_event_snapshots_v1", "run_id"],
  ["live_event_snapshots_v1", "supersedes_id"],
  ["live_monitor_alerts_v1", "watchlist_id"],
  ["market_provider_snapshots_v2", "capture_id"],
  ["model_predictions", "match_id"],
  ["notification_deliveries", "device_id"],
  ["player_status", "match_id"],
  ["predictions", "match_id"],
  ["shadow_learning_samples", "bet_id"],
  ["sports_analytics_observations", "snapshot_id"],
  ["unified_data_closing_records", "closing_snapshot_id"],
  ["unified_data_closing_records", "opening_snapshot_id"]
];

test("production performance patch covers every advisor-reported foreign key", async () => {
  const sql = await migration();
  const indexStatements = sql.match(/create index if not exists/gi) || [];
  assert.equal(indexStatements.length, FK_INDEXES.length);

  for (const [table, column] of FK_INDEXES) {
    assert.match(sql, new RegExp(`on\\s+public\\.${table}\\s*\\(\\s*${column}\\s*\\)`, "i"));
  }
});

test("RLS optimization preserves ownership while eliminating per-row auth.uid evaluation", async () => {
  const sql = executableSql(await migration());
  const authCalls = sql.match(/auth\.uid\(\)/g) || [];
  const initPlanCalls = sql.match(/\(select auth\.uid\(\)\)/g) || [];
  assert.ok(authCalls.length > 30);
  assert.equal(authCalls.length, initPlanCalls.length);

  assert.match(sql, /alter policy "Users manage own bankroll settings"[\s\S]*paper_trading_mode\s*=\s*true/i);
  assert.match(sql, /alter policy "Users insert own AI Coach preferences"[\s\S]*paper_only\s*=\s*true/i);
  assert.match(sql, /alter policy "Users update own live monitor alerts"[\s\S]*paper_only\s*=\s*true/i);
  assert.match(sql, /alter policy "Users insert own live monitor preferences"[\s\S]*paper_only\s*=\s*true/i);
  assert.match(sql, /alter policy "Users update own live monitor preferences"[\s\S]*paper_only\s*=\s*true/i);
});

test("legacy duplicate bets policies are removed and the authenticated ownership policy remains", async () => {
  const sql = await migration();
  for (const name of [
    "Users can read own bets",
    "Users can insert own bets",
    "Users can update own bets",
    "Users can delete own bets"
  ]) {
    assert.match(sql, new RegExp(`drop policy if exists \\\"${name}\\\" on public\\.bets`, "i"));
  }

  assert.match(sql, /alter policy "Users manage own bets" on public\.bets\s+to authenticated[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/i);
});

test("user_settings is narrowed to authenticated without broadening database privileges", async () => {
  const sql = executableSql(await migration());
  for (const name of [
    "Users can read own settings",
    "Users can insert own settings",
    "Users can update own settings"
  ]) {
    assert.match(sql, new RegExp(`alter policy \\\"${name}\\\" on public\\.user_settings\\s+to authenticated`, "i"));
  }

  assert.doesNotMatch(sql, /\bgrant\b/i);
  assert.doesNotMatch(sql, /\brevoke\b/i);
  assert.doesNotMatch(sql, /disable\s+row\s+level\s+security/i);
  assert.doesNotMatch(sql, /security\s+definer/i);
});

test("patch is performance-only and keeps the paper boundary explicit", async () => {
  const sql = executableSql(await migration());
  const documented = await migration();
  assert.match(documented, /no real-money execution capability is introduced/i);
  assert.doesNotMatch(sql, /bookmaker.*login/i);
  assert.doesNotMatch(sql, /deposit|withdrawal|cash out/i);
  assert.doesNotMatch(sql, /drop\s+table|truncate\s+table|delete\s+from/i);
});
