import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildMigrationReleaseStatus } from "../lib/migration-release-status.mjs";

const root = new URL("../", import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

const manifest = await json("config/release-readiness.json");
const canonicalStatus = await json("config/production-migration-status.json");

function allAppliedStatus() {
  return {
    schemaVersion: 1,
    environment: "production",
    updatedAt: "2026-08-08T06:10:00.000Z",
    updatedBy: "release-reviewer",
    migrations: manifest.supabaseMigrations.map((path, index) => ({
      path,
      status: "applied",
      verifiedAt: `2026-08-08T06:${String(index).padStart(2, "0")}:00.000Z`,
      verifiedBy: "release-reviewer",
      evidence: `release-evidence/migrations.json#${index + 1}`
    }))
  };
}

test("canonical registry stays unverified until production evidence is explicitly recorded", () => {
  const result = buildMigrationReleaseStatus({ manifest, statusDocument: canonicalStatus });

  assert.equal(result.configuredMigrationCount, 21);
  assert.equal(result.recordedMigrationCount, 21);
  assert.equal(result.verifiedAppliedCount, 0);
  assert.equal(result.unverifiedCount, 21);
  assert.equal(result.unresolvedCount, 21);
  assert.equal(result.orderMatchesManifest, true);
  assert.equal(result.validationPassed, true);
  assert.equal(result.productionVerified, false);
  assert.equal(result.status, "unverified");
  assert.equal(result.statusFingerprint.length, 64);
  assert.equal(result.safety.filePresenceUsedAsProductionProof, false);
  assert.equal(result.safety.rawEvidenceRefsIncluded, false);
  assert.equal(result.safety.databaseCredentialsIncluded, false);
  assert.equal(result.safety.userDataIncluded, false);

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /release-evidence\/.*#/i);
  assert.doesNotMatch(serialized, /release-reviewer/i);
  assert.doesNotMatch(serialized, /service[_-]?role|password|bearer\s+[a-z0-9._-]{20,}/i);
});

test("all configured migrations become passed only with complete explicit evidence", () => {
  const result = buildMigrationReleaseStatus({ manifest, statusDocument: allAppliedStatus() });

  assert.equal(result.status, "passed");
  assert.equal(result.productionVerified, true);
  assert.equal(result.validationPassed, true);
  assert.equal(result.orderMatchesManifest, true);
  assert.equal(result.verifiedAppliedCount, manifest.supabaseMigrations.length);
  assert.equal(result.unresolvedCount, 0);
  assert.equal(result.validationFailureCount, 0);
  assert.equal(result.statusFingerprint.length, 64);
});

test("an applied migration without verification evidence fails closed", () => {
  const statusDocument = allAppliedStatus();
  statusDocument.migrations[3] = {
    ...statusDocument.migrations[3],
    evidence: null
  };

  const result = buildMigrationReleaseStatus({ manifest, statusDocument });
  assert.equal(result.status, "failed");
  assert.equal(result.productionVerified, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.validationFailures.includes("applied-migration-missing-evidence"));
});

test("migration order drift fails even when every entry claims applied", () => {
  const statusDocument = allAppliedStatus();
  [statusDocument.migrations[0], statusDocument.migrations[1]] = [
    statusDocument.migrations[1],
    statusDocument.migrations[0]
  ];

  const result = buildMigrationReleaseStatus({ manifest, statusDocument });
  assert.equal(result.status, "failed");
  assert.equal(result.productionVerified, false);
  assert.equal(result.orderMatchesManifest, false);
  assert.ok(result.validationFailures.includes("migration-order-mismatch"));
});

test("explicit missing or blocked migration is a failed production state", () => {
  for (const blockedStatus of ["missing", "blocked"]) {
    const statusDocument = structuredClone(canonicalStatus);
    statusDocument.migrations[0].status = blockedStatus;
    const result = buildMigrationReleaseStatus({ manifest, statusDocument });
    assert.equal(result.status, "failed");
    assert.equal(result.productionVerified, false);
    assert.equal(result.unresolvedCount, 21);
  }
});
