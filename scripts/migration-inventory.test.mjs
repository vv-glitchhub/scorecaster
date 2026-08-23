import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  analyzeMigrationSql,
  buildMigrationInventory,
  inventoryMarkdown
} from "./migration-inventory.mjs";

const repositoryRoot = path.resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalMigrationCount = 28;
const signingVaultMigration = "supabase/scorecaster_agent_decision_signing_vault.sql";
const collectorMigration = "supabase/scorecaster_collector_v1.sql";
const autonomousRiskMigration = "supabase/scorecaster_autonomous_agent_risk_profile_v1.sql";
const v13HardCapsMigration = "supabase/scorecaster_autonomous_v13_hard_caps.sql";
const shadowLearningMigration = "supabase/scorecaster_shadow_learning_v1.sql";
const shadowCandidateMigrations = [
  "supabase/scorecaster_shadow_candidate_observations_v1.sql",
  "supabase/scorecaster_shadow_candidate_settlement_batch_v1.sql",
  "supabase/scorecaster_shadow_candidate_trigger_safety_v1.sql",
  "supabase/scorecaster_shadow_candidate_settlement_batch_v1_fix.sql",
  "supabase/scorecaster_shadow_candidate_function_acl_v1.sql"
];

function dirname(value) {
  return path.dirname(value);
}

test("canonical repository migration inventory is complete and ordered", async () => {
  const inventory = await buildMigrationInventory({ root: repositoryRoot });

  assert.equal(inventory.summary.configuredMigrationCount, canonicalMigrationCount);
  assert.equal(inventory.summary.discoveredMigrationCount, canonicalMigrationCount);
  assert.equal(inventory.summary.repositoryComplete, true);
  assert.deepEqual(inventory.validation.missingFiles, []);
  assert.deepEqual(inventory.validation.untrackedFiles, []);
  assert.deepEqual(inventory.validation.statusFailures, []);
  assert.equal(inventory.migrations[0].path, "supabase/scorecaster_schema.sql");
  const signingIndex = inventory.migrations.findIndex((migration) => migration.path === signingVaultMigration);
  const collectorIndex = inventory.migrations.findIndex((migration) => migration.path === collectorMigration);
  assert.equal(signingIndex, collectorIndex - 1);
  assert.equal(inventory.migrations.at(-8).path, v13HardCapsMigration);
  assert.equal(inventory.migrations.at(-7).path, autonomousRiskMigration);
  assert.equal(inventory.migrations.at(-6).path, shadowLearningMigration);
  assert.deepEqual(inventory.migrations.slice(-5).map((migration) => migration.path), shadowCandidateMigrations);
  assert.ok(inventory.migrations.every((migration) => /^[a-f0-9]{64}$/.test(migration.checksumSha256)));
});

test("static SQL analysis detects destructive operations and inventory objects", () => {
  const analysis = analyzeMigrationSql(`
    create table if not exists public.example_rows (id bigint primary key);
    create index if not exists example_rows_idx on public.example_rows (id);
    create or replace function public.example_claim() returns void language sql as $$ select null $$;
    create trigger example_trigger before insert on public.example_rows execute function public.example_claim();
    alter table public.example_rows drop column obsolete;
  `);

  assert.equal(analysis.requiresManualReview, true);
  assert.equal(analysis.destructiveFlags.alterDropColumn, true);
  assert.deepEqual(analysis.objects.tables, ["example_rows"]);
  assert.deepEqual(analysis.objects.functions, ["example_claim"]);
  assert.deepEqual(analysis.objects.triggers, ["example_trigger"]);
  assert.deepEqual(analysis.objects.indexes, ["example_rows_idx"]);
});

test("policy replacement is distinguished from data-destructive SQL", () => {
  const analysis = analyzeMigrationSql(`
    drop policy if exists "Users read own rows" on public.example_rows;
    create policy "Users read own rows" on public.example_rows for select using (auth.uid() = user_id);
  `);

  assert.equal(analysis.requiresManualReview, false);
  assert.equal(analysis.containsPolicyReplacement, true);
  assert.equal(analysis.operationalFlags.dropPolicy, true);
});

test("applied production status requires evidence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "scorecaster-migrations-"));
  await mkdir(path.join(root, "config"), { recursive: true });
  await mkdir(path.join(root, "supabase"), { recursive: true });
  await writeFile(path.join(root, "supabase/scorecaster_schema.sql"), "create table public.test_rows(id bigint);\n");
  await writeFile(path.join(root, "config/release-readiness.json"), JSON.stringify({
    product: "Scorecaster",
    productBoundary: "sports analysis, risk control and virtual paper tracking only",
    supabaseMigrations: ["supabase/scorecaster_schema.sql"]
  }));
  await writeFile(path.join(root, "config/production-migration-status.json"), JSON.stringify({
    schemaVersion: 1,
    environment: "production",
    migrations: [{ path: "supabase/scorecaster_schema.sql", status: "applied" }]
  }));

  const inventory = await buildMigrationInventory({ root });
  assert.ok(inventory.validation.statusFailures.some((failure) => failure.includes("requires verifiedAt")));
  assert.equal(inventory.summary.productionVerified, false);
});

test("markdown explicitly separates repository analysis from production evidence", async () => {
  const inventory = await buildMigrationInventory({ root: repositoryRoot });
  const markdown = inventoryMarkdown(inventory);
  assert.match(markdown, /Production status is manual evidence/);
  assert.match(markdown, new RegExp(`Configured migrations: ${canonicalMigrationCount}`));
  assert.doesNotMatch(markdown, /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|ODDS_API_KEY/);

  const status = JSON.parse(await readFile(path.join(repositoryRoot, "config/production-migration-status.json"), "utf8"));
  assert.equal(status.environment, "production");
  assert.equal(status.migrations.length, canonicalMigrationCount);
  assert.ok(status.migrations.every((migration) => migration.status === "applied"));
  assert.ok(status.migrations.every((migration) => typeof migration.verifiedAt === "string" && migration.verifiedAt.length > 0));
  assert.ok(status.migrations.every((migration) => typeof migration.verifiedBy === "string" && migration.verifiedBy.length > 0));

  const legacyEvidence = /^docs\/PRODUCTION_MIGRATION_EVIDENCE_2026_08_10\.md#/;
  assert.ok(status.migrations.filter((migration) => ![signingVaultMigration, autonomousRiskMigration, ...shadowCandidateMigrations].includes(migration.path)).every((migration) => legacyEvidence.test(migration.evidence || "")));
  const signingEvidence = status.migrations.find((migration) => migration.path === signingVaultMigration);
  assert.equal(signingEvidence?.evidence, "docs/PRODUCTION_AGENT_SIGNING_VAULT_EVIDENCE_2026_08_18.md");
  const autonomousRiskEvidence = status.migrations.find((migration) => migration.path === autonomousRiskMigration);
  assert.equal(autonomousRiskEvidence?.evidence, "docs/PRODUCTION_AUTONOMOUS_RISK_PROFILE_EVIDENCE_2026_08_19.md");
  const signingIndex = status.migrations.findIndex((migration) => migration.path === signingVaultMigration);
  const collectorIndex = status.migrations.findIndex((migration) => migration.path === collectorMigration);
  assert.equal(signingIndex, collectorIndex - 1);
  assert.equal(status.migrations.at(-8).path, v13HardCapsMigration);
  assert.equal(status.migrations.at(-7).path, autonomousRiskMigration);
  assert.equal(status.migrations.at(-6).path, shadowLearningMigration);
  assert.deepEqual(status.migrations.slice(-5).map((migration) => migration.path), shadowCandidateMigrations);
  assert.ok(status.migrations.slice(-5).every((migration) => /^docs\/PRODUCTION_SHADOW_CANDIDATE_MIGRATION_EVIDENCE_2026_08_22\.md#/.test(migration.evidence || "")));
  assert.equal(inventory.summary.productionVerified, true);
});
