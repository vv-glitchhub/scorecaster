import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const riskMigration = "supabase/scorecaster_autonomous_agent_risk_profile_v1.sql";
const hardCapsMigration = "supabase/scorecaster_autonomous_v13_hard_caps.sql";
const shadowMigration = "supabase/scorecaster_shadow_learning_v1.sql";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}
async function writeJson(path, value) {
  await writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function moveAfter(items, value, anchor) {
  const filtered = items.filter((item) => item !== value);
  const anchorIndex = filtered.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`Missing ordering anchor ${anchor}`);
  filtered.splice(anchorIndex + 1, 0, value);
  return filtered;
}
function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

const manifest = await readJson("config/release-readiness.json");
manifest.supabaseMigrations = moveAfter(manifest.supabaseMigrations, riskMigration, hardCapsMigration);
await writeJson("config/release-readiness.json", manifest);

const status = await readJson("config/production-migration-status.json");
const riskEntry = status.migrations.find((entry) => entry.path === riskMigration);
if (!riskEntry) throw new Error("Missing production risk migration evidence");
status.migrations = moveAfter(status.migrations.map((entry) => entry.path), riskMigration, hardCapsMigration)
  .map((path) => path === riskMigration ? riskEntry : status.migrations.find((entry) => entry.path === path));
status.notes = "Repository file presence never proves production application. All canonical entries are backed by explicit production evidence. The canonical dependency order keeps Autonomous V13 hard caps immediately after V2, then applies Autonomous Risk Profile V1, with Shadow Learning final. The risk-profile migration was historically applied later in production on 2026-08-19 and that actual registry timestamp is preserved in its evidence.";
await writeJson("config/production-migration-status.json", status);

const releaseAuditUrl = new URL("scripts/release-readiness.mjs", root);
let releaseAudit = await readFile(releaseAuditUrl, "utf8");
releaseAudit = replaceRequired(
  releaseAudit,
  'const autonomousV13HardCapsIndex = migrations.indexOf("supabase/scorecaster_autonomous_v13_hard_caps.sql");\nconst shadowLearningIndex = migrations.indexOf("supabase/scorecaster_shadow_learning_v1.sql");',
  'const autonomousV13HardCapsIndex = migrations.indexOf("supabase/scorecaster_autonomous_v13_hard_caps.sql");\nconst autonomousRiskProfileIndex = migrations.indexOf("supabase/scorecaster_autonomous_agent_risk_profile_v1.sql");\nconst shadowLearningIndex = migrations.indexOf("supabase/scorecaster_shadow_learning_v1.sql");',
  "release audit risk index"
);
releaseAudit = replaceRequired(
  releaseAudit,
  'check(autonomousV13HardCapsIndex === autonomousV2Index + 1, "Autonomous V13 hard caps must run immediately after V2");\ncheck(shadowLearningIndex === autonomousV13HardCapsIndex + 1, "Shadow Learning must run immediately after V13 hard caps");',
  'check(autonomousV13HardCapsIndex === autonomousV2Index + 1, "Autonomous V13 hard caps must run immediately after V2");\ncheck(autonomousRiskProfileIndex === autonomousV13HardCapsIndex + 1, "Autonomous Risk Profile V1 must run immediately after V13 hard caps");\ncheck(shadowLearningIndex === autonomousRiskProfileIndex + 1, "Shadow Learning must run immediately after Autonomous Risk Profile V1");',
  "release audit dependency chain"
);
await writeFile(releaseAuditUrl, releaseAudit, "utf8");

const releaseTestUrl = new URL("scripts/release-readiness.test.mjs", root);
let releaseTest = await readFile(releaseTestUrl, "utf8");
releaseTest = replaceRequired(releaseTest, "assert.equal(manifest.supabaseMigrations.length, 22);", "assert.equal(manifest.supabaseMigrations.length, 23);", "release migration count");
releaseTest = replaceRequired(
  releaseTest,
  '  assert.equal(manifest.supabaseMigrations.at(-5), "supabase/scorecaster_settlement_monitor.sql");\n  assert.equal(manifest.supabaseMigrations.at(-4), "supabase/scorecaster_autonomous_agent.sql");\n  assert.equal(manifest.supabaseMigrations.at(-3), "supabase/scorecaster_autonomous_agent_v2.sql");\n  assert.equal(manifest.supabaseMigrations.at(-2), "supabase/scorecaster_autonomous_v13_hard_caps.sql");\n  assert.equal(manifest.supabaseMigrations.at(-1), "supabase/scorecaster_shadow_learning_v1.sql");',
  '  assert.equal(manifest.supabaseMigrations.at(-6), "supabase/scorecaster_settlement_monitor.sql");\n  assert.equal(manifest.supabaseMigrations.at(-5), "supabase/scorecaster_autonomous_agent.sql");\n  assert.equal(manifest.supabaseMigrations.at(-4), "supabase/scorecaster_autonomous_agent_v2.sql");\n  assert.equal(manifest.supabaseMigrations.at(-3), "supabase/scorecaster_autonomous_v13_hard_caps.sql");\n  assert.equal(manifest.supabaseMigrations.at(-2), "supabase/scorecaster_autonomous_agent_risk_profile_v1.sql");\n  assert.equal(manifest.supabaseMigrations.at(-1), "supabase/scorecaster_shadow_learning_v1.sql");',
  "release tail order"
);
releaseTest = replaceRequired(
  releaseTest,
  '    "scorecaster_autonomous_v13_hard_caps.sql",\n    "scorecaster_shadow_learning_v1.sql",',
  '    "scorecaster_autonomous_v13_hard_caps.sql",\n    "scorecaster_autonomous_agent_risk_profile_v1.sql",\n    "scorecaster_shadow_learning_v1.sql",',
  "release token coverage"
);
releaseTest = replaceRequired(
  releaseTest,
  '  assert.match(audit, /Autonomous V13 hard caps must run immediately after V2/);\n  assert.match(audit, /Shadow Learning must run immediately after V13 hard caps/);',
  '  assert.match(audit, /Autonomous V13 hard caps must run immediately after V2/);\n  assert.match(audit, /Autonomous Risk Profile V1 must run immediately after V13 hard caps/);\n  assert.match(audit, /Shadow Learning must run immediately after Autonomous Risk Profile V1/);',
  "release audit message coverage"
);
releaseTest = replaceRequired(
  releaseTest,
  '  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "autonomous-agent-v13-audit" && item.blocking === true));',
  '  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "autonomous-agent-v13-audit" && item.blocking === true));\n  assert.ok(manifest.manualReleaseChecks.some((item) => item.id === "autonomous-agent-risk-profile" && item.blocking === true));',
  "release manual risk check"
);
await writeFile(releaseTestUrl, releaseTest, "utf8");

const inventoryTestUrl = new URL("scripts/migration-inventory.test.mjs", root);
let inventoryTest = await readFile(inventoryTestUrl, "utf8");
inventoryTest = replaceRequired(
  inventoryTest,
  "  assert.equal(inventory.migrations.at(-3).path, autonomousRiskMigration);\n  assert.equal(inventory.migrations.at(-2).path, v13HardCapsMigration);",
  "  assert.equal(inventory.migrations.at(-3).path, v13HardCapsMigration);\n  assert.equal(inventory.migrations.at(-2).path, autonomousRiskMigration);",
  "inventory tail order"
);
inventoryTest = replaceRequired(
  inventoryTest,
  "  assert.equal(status.migrations.at(-3).path, autonomousRiskMigration);\n  assert.equal(status.migrations.at(-2).path, v13HardCapsMigration);",
  "  assert.equal(status.migrations.at(-3).path, v13HardCapsMigration);\n  assert.equal(status.migrations.at(-2).path, autonomousRiskMigration);",
  "status tail order"
);
await writeFile(inventoryTestUrl, inventoryTest, "utf8");

const docsUrl = new URL("docs/PRODUCTION_MIGRATION_INVENTORY_V1.md", root);
let docs = await readFile(docsUrl, "utf8");
docs = replaceRequired(
  docs,
  "`supabase/scorecaster_autonomous_agent_risk_profile_v1.sql` is ordered after Autonomous Agent V2 and before the V13 database hard caps because it extends the V2 settings and audit tables. The final migration remains `supabase/scorecaster_shadow_learning_v1.sql`.",
  "The V13 database hard caps remain immediately after Autonomous Agent V2. `supabase/scorecaster_autonomous_agent_risk_profile_v1.sql` follows the hard-cap migration because it extends the V2 settings and audit tables without weakening the hard-cap trigger. The final migration remains `supabase/scorecaster_shadow_learning_v1.sql`."
  ,"inventory docs order"
);
await writeFile(docsUrl, docs, "utf8");

if (manifest.supabaseMigrations.at(-3) !== hardCapsMigration || manifest.supabaseMigrations.at(-2) !== riskMigration || manifest.supabaseMigrations.at(-1) !== shadowMigration) {
  throw new Error("Canonical autonomous migration tail is not V13 hard caps -> risk profile -> Shadow Learning");
}
