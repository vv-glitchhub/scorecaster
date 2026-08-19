import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

async function writeJson(path, value) {
  await writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const migrationPath = "supabase/scorecaster_autonomous_agent_risk_profile_v1.sql";
const riskApiPath = "/api/cloud/autonomous-agent/risk-profile";

const manifest = await readJson("config/release-readiness.json");
if (!manifest.supabaseMigrations.includes(migrationPath)) {
  const anchor = manifest.supabaseMigrations.indexOf("supabase/scorecaster_autonomous_agent_v2.sql");
  if (anchor < 0) throw new Error("Missing autonomous V2 migration anchor");
  manifest.supabaseMigrations.splice(anchor + 1, 0, migrationPath);
}
if (!manifest.protectedApis.some((item) => item.path === riskApiPath)) {
  const anchor = manifest.protectedApis.findIndex((item) => item.path === "/api/cloud/autonomous-agent");
  if (anchor < 0) throw new Error("Missing autonomous API release anchor");
  manifest.protectedApis.splice(anchor + 1, 0, {
    path: riskApiPath,
    method: "GET",
    allowedStatuses: [401, 403]
  });
}
if (!manifest.manualReleaseChecks.some((item) => item.id === "autonomous-agent-risk-profile")) {
  const anchor = manifest.manualReleaseChecks.findIndex((item) => item.id === "autonomous-agent-v13-audit");
  if (anchor < 0) throw new Error("Missing autonomous audit release anchor");
  manifest.manualReleaseChecks.splice(anchor + 1, 0, {
    id: "autonomous-agent-risk-profile",
    title: "Autonomous V13 applies the user-selected conservative, balanced or aggressive paper recommendation profile end to end while personal minimums and 1/5/2.5 percent hard caps remain authoritative",
    blocking: true
  });
}
await writeJson("config/release-readiness.json", manifest);

const status = await readJson("config/production-migration-status.json");
const migrationEntry = {
  path: migrationPath,
  status: "applied",
  verifiedAt: "2026-08-19T03:37:04Z",
  verifiedBy: "ChatGPT production migration and catalog verification via Supabase connector",
  evidence: "docs/PRODUCTION_AUTONOMOUS_RISK_PROFILE_EVIDENCE_2026_08_19.md",
  notes: "Production migration registry version 20260819033704. Risk profile and policy columns, balanced backfill, constraints, scheduling trigger, RLS and FORCE RLS verified with aggregate-only evidence."
};
const existing = status.migrations.findIndex((item) => item.path === migrationPath);
if (existing >= 0) status.migrations[existing] = migrationEntry;
else {
  const anchor = status.migrations.findIndex((item) => item.path === "supabase/scorecaster_autonomous_agent_v2.sql");
  if (anchor < 0) throw new Error("Missing autonomous V2 production-status anchor");
  status.migrations.splice(anchor + 1, 0, migrationEntry);
}
status.updatedAt = "2026-08-19T03:37:04Z";
status.updatedBy = "ChatGPT production migration and catalog verification via Supabase connector";
status.notes = "Repository file presence never proves production application. All canonical entries are backed by explicit production evidence. Agent signing and Autonomous Risk Profile V1 were applied through the Supabase migration API and separately verified with redacted catalog, RLS and privilege evidence.";
await writeJson("config/production-migration-status.json", status);

const inventoryTestUrl = new URL("scripts/migration-inventory.test.mjs", root);
let inventoryTest = await readFile(inventoryTestUrl, "utf8");
inventoryTest = inventoryTest.replace("const canonicalMigrationCount = 22;", "const canonicalMigrationCount = 23;");
inventoryTest = inventoryTest.replace(
  'const v13HardCapsMigration = "supabase/scorecaster_autonomous_v13_hard_caps.sql";',
  'const autonomousRiskMigration = "supabase/scorecaster_autonomous_agent_risk_profile_v1.sql";\nconst v13HardCapsMigration = "supabase/scorecaster_autonomous_v13_hard_caps.sql";'
);
inventoryTest = inventoryTest.replace(
  '  assert.equal(inventory.migrations.at(-2).path, v13HardCapsMigration);',
  '  assert.equal(inventory.migrations.at(-3).path, autonomousRiskMigration);\n  assert.equal(inventory.migrations.at(-2).path, v13HardCapsMigration);'
);
inventoryTest = inventoryTest.replace(
  '  assert.ok(status.migrations.filter((migration) => migration.path !== signingVaultMigration).every((migration) => legacyEvidence.test(migration.evidence || "")));',
  '  assert.ok(status.migrations.filter((migration) => ![signingVaultMigration, autonomousRiskMigration].includes(migration.path)).every((migration) => legacyEvidence.test(migration.evidence || "")));'
);
inventoryTest = inventoryTest.replace(
  '  const signingIndex = status.migrations.findIndex((migration) => migration.path === signingVaultMigration);',
  '  const autonomousRiskEvidence = status.migrations.find((migration) => migration.path === autonomousRiskMigration);\n  assert.equal(autonomousRiskEvidence?.evidence, "docs/PRODUCTION_AUTONOMOUS_RISK_PROFILE_EVIDENCE_2026_08_19.md");\n  const signingIndex = status.migrations.findIndex((migration) => migration.path === signingVaultMigration);'
);
inventoryTest = inventoryTest.replace(
  '  assert.equal(status.migrations.at(-2).path, v13HardCapsMigration);',
  '  assert.equal(status.migrations.at(-3).path, autonomousRiskMigration);\n  assert.equal(status.migrations.at(-2).path, v13HardCapsMigration);'
);
await writeFile(inventoryTestUrl, inventoryTest, "utf8");

const releaseStatusTestUrl = new URL("scripts/migration-release-status.test.mjs", root);
let releaseStatusTest = await readFile(releaseStatusTestUrl, "utf8");
releaseStatusTest = releaseStatusTest.replace("assert.equal(canonicalMigrationCount, 22);", "assert.equal(canonicalMigrationCount, 23);");
await writeFile(releaseStatusTestUrl, releaseStatusTest, "utf8");

const docsUrl = new URL("docs/PRODUCTION_MIGRATION_INVENTORY_V1.md", root);
let docs = await readFile(docsUrl, "utf8");
docs = docs.replace(
  "The canonical ordered rollout contains 21 migrations. During this work package, two migrations were found in `supabase/` but missing from the release manifest:",
  "The canonical ordered rollout now contains 23 migrations. The inventory includes every reviewed `supabase/scorecaster_*.sql` migration, including the independently verified Agent signing migration and Autonomous Risk Profile V1. During the original inventory work package, two migrations were found in `supabase/` but missing from the release manifest:"
);
docs = docs.replace(
  "Both are now included in the reviewed order. The final migration remains `supabase/scorecaster_shadow_learning_v1.sql`.",
  "Both are included in the reviewed order. `supabase/scorecaster_autonomous_agent_risk_profile_v1.sql` is ordered after Autonomous Agent V2 and before the V13 database hard caps because it extends the V2 settings and audit tables. The final migration remains `supabase/scorecaster_shadow_learning_v1.sql`."
);
await writeFile(docsUrl, docs, "utf8");
