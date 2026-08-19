import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

const runnerUrl = new URL("scripts/production-activation.mjs", root);
let runner = await readFile(runnerUrl, "utf8");
runner = replaceRequired(
  runner,
  'assert(migrations.length === 22, "Release manifest does not contain the complete canonical rollout");',
  'assert(migrations.length === 23, "Release manifest does not contain the complete canonical rollout");',
  "activation migration count"
);
await writeFile(runnerUrl, runner, "utf8");

const testUrl = new URL("scripts/production-activation.test.mjs", root);
let test = await readFile(testUrl, "utf8");
test = replaceRequired(test, "assert.equal(manifest.supabaseMigrations.length, 22);", "assert.equal(manifest.supabaseMigrations.length, 23);", "test migration count");
test = replaceRequired(
  test,
  '  assert.equal(manifest.supabaseMigrations.at(-5), "supabase/scorecaster_settlement_monitor.sql");\n  assert.equal(manifest.supabaseMigrations.at(-4), "supabase/scorecaster_autonomous_agent.sql");\n  assert.equal(manifest.supabaseMigrations.at(-3), "supabase/scorecaster_autonomous_agent_v2.sql");\n  assert.equal(manifest.supabaseMigrations.at(-2), "supabase/scorecaster_autonomous_v13_hard_caps.sql");\n  assert.equal(manifest.supabaseMigrations.at(-1), "supabase/scorecaster_shadow_learning_v1.sql");',
  '  assert.equal(manifest.supabaseMigrations.at(-6), "supabase/scorecaster_settlement_monitor.sql");\n  assert.equal(manifest.supabaseMigrations.at(-5), "supabase/scorecaster_autonomous_agent.sql");\n  assert.equal(manifest.supabaseMigrations.at(-4), "supabase/scorecaster_autonomous_agent_v2.sql");\n  assert.equal(manifest.supabaseMigrations.at(-3), "supabase/scorecaster_autonomous_v13_hard_caps.sql");\n  assert.equal(manifest.supabaseMigrations.at(-2), "supabase/scorecaster_autonomous_agent_risk_profile_v1.sql");\n  assert.equal(manifest.supabaseMigrations.at(-1), "supabase/scorecaster_shadow_learning_v1.sql");',
  "activation migration tail"
);
test = replaceRequired(test, "assert.match(runner, /migrations\\.length === 22/);", "assert.match(runner, /migrations\\.length === 23/);", "runner count assertion");
test = replaceRequired(
  test,
  '  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_sports_analytics.sql"));',
  '  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_sports_analytics.sql"));\n  assert.ok(manifest.supabaseMigrations.includes("supabase/scorecaster_autonomous_agent_risk_profile_v1.sql"));',
  "activation risk migration presence"
);
test = replaceRequired(
  test,
  '  const autonomousV2 = await source("supabase/scorecaster_autonomous_agent_v2.sql");\n  const shadow = await source("supabase/scorecaster_shadow_learning_v1.sql");',
  '  const autonomousV2 = await source("supabase/scorecaster_autonomous_agent_v2.sql");\n  const autonomousRisk = await source("supabase/scorecaster_autonomous_agent_risk_profile_v1.sql");\n  const shadow = await source("supabase/scorecaster_shadow_learning_v1.sql");',
  "risk migration verifier source"
);
test = replaceRequired(
  test,
  '  assert.match(sql, /autonomous_agent_settings_schedule/);',
  '  assert.match(sql, /autonomous_agent_settings_schedule/);\n  assert.match(autonomousRisk, /risk_profile/);\n  assert.match(autonomousRisk, /risk_policy/);\n  assert.match(autonomousRisk, /schedule_autonomous_agent_for_user/);',
  "risk migration verifier assertions"
);
await writeFile(testUrl, test, "utf8");
