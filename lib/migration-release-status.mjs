import { createHash } from "node:crypto";

const ALLOWED_STATUSES = new Set([
  "unverified",
  "applied",
  "missing",
  "superseded",
  "manual-review",
  "blocked"
]);

const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

const fingerprint = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildMigrationReleaseStatus({ manifest = {}, statusDocument = {} } = {}) {
  const configured = Array.isArray(manifest.supabaseMigrations)
    ? manifest.supabaseMigrations.map((item) => clean(item, 180)).filter(Boolean)
    : [];
  const entries = Array.isArray(statusDocument.migrations) ? statusDocument.migrations : [];
  const failures = [];
  const seen = new Set();

  if (statusDocument.schemaVersion !== 1) failures.push("invalid-schema-version");
  if (statusDocument.environment !== "production") failures.push("invalid-environment");
  if (entries.length !== configured.length) failures.push("migration-count-mismatch");

  const normalized = entries.map((entry, index) => {
    const path = clean(entry?.path, 180);
    const status = clean(entry?.status, 32).toLowerCase();
    if (!path || seen.has(path)) failures.push("duplicate-or-empty-migration-path");
    seen.add(path);
    if (path !== configured[index]) failures.push("migration-order-mismatch");
    if (!ALLOWED_STATUSES.has(status)) failures.push("unsupported-migration-status");

    const verifiedAt = clean(entry?.verifiedAt, 64) || null;
    const verifiedByPresent = Boolean(clean(entry?.verifiedBy, 120));
    const evidencePresent = Boolean(clean(entry?.evidence, 240));
    if (status === "applied" && !(verifiedAt && verifiedByPresent && evidencePresent)) {
      failures.push("applied-migration-missing-evidence");
    }

    return {
      path,
      status: ALLOWED_STATUSES.has(status) ? status : "unverified",
      verifiedAt,
      verifiedByPresent,
      evidencePresent
    };
  });

  const counts = Object.fromEntries([...ALLOWED_STATUSES].map((status) => [
    status,
    normalized.filter((entry) => entry.status === status).length
  ]));
  const allApplied = configured.length > 0
    && normalized.length === configured.length
    && normalized.every((entry) => entry.status === "applied" && entry.verifiedAt && entry.verifiedByPresent && entry.evidencePresent);
  const validationPassed = failures.length === 0;
  const productionVerified = validationPassed && allApplied;
  const explicitFailure = normalized.some((entry) => entry.status === "missing" || entry.status === "blocked");
  const status = productionVerified ? "passed" : (!validationPassed || explicitFailure) ? "failed" : "unverified";

  const statusIdentity = normalized.map((entry) => ({
    path: entry.path,
    status: entry.status,
    verifiedAt: entry.verifiedAt,
    verifiedByPresent: entry.verifiedByPresent,
    evidencePresent: entry.evidencePresent
  }));

  return {
    status,
    observedAt: clean(statusDocument.updatedAt, 64) || null,
    evidenceRef: null,
    registrySchemaVersion: statusDocument.schemaVersion === 1 ? 1 : null,
    configuredMigrationCount: configured.length,
    recordedMigrationCount: normalized.length,
    verifiedAppliedCount: counts.applied || 0,
    unverifiedCount: counts.unverified || 0,
    unresolvedCount: normalized.filter((entry) => entry.status !== "applied").length,
    counts,
    orderMatchesManifest: normalized.length === configured.length
      && normalized.every((entry, index) => entry.path === configured[index]),
    validationPassed,
    productionVerified,
    statusFingerprint: fingerprint(statusIdentity),
    validationFailureCount: failures.length,
    validationFailures: [...new Set(failures)],
    safety: {
      filePresenceUsedAsProductionProof: false,
      rawEvidenceRefsIncluded: false,
      databaseCredentialsIncluded: false,
      userDataIncluded: false
    }
  };
}
