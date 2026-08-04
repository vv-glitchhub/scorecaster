import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED_STATUSES = new Set([
  "unverified",
  "applied",
  "missing",
  "superseded",
  "manual-review",
  "blocked"
]);

function normalizeSql(sql) {
  return String(sql || "").replace(/\r\n/g, "\n");
}

function matchNames(sql, expression) {
  return [...sql.matchAll(expression)].map((match) => match[1]).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

export function analyzeMigrationSql(sql) {
  const normalized = normalizeSql(sql);
  const lower = normalized.toLowerCase();
  const deleteStatements = lower.match(/delete\s+from\s+[\s\S]*?;/g) || [];
  const updateStatements = lower.match(/update\s+[\s\S]*?;/g) || [];

  const destructiveFlags = {
    dropTable: /\bdrop\s+table\b/i.test(normalized),
    dropSchema: /\bdrop\s+schema\b/i.test(normalized),
    truncate: /\btruncate(?:\s+table)?\b/i.test(normalized),
    alterDropColumn: /\balter\s+table[\s\S]*?\bdrop\s+column\b/i.test(normalized),
    deleteWithoutWhere: deleteStatements.some((statement) => !/\bwhere\b/i.test(statement)),
    updateWithoutWhere: updateStatements.some((statement) => !/\bwhere\b/i.test(statement))
  };

  const operationalFlags = {
    dropFunction: /\bdrop\s+function\b/i.test(normalized),
    dropTrigger: /\bdrop\s+trigger\b/i.test(normalized),
    dropPolicy: /\bdrop\s+policy\b/i.test(normalized),
    revoke: /\brevoke\b/i.test(normalized)
  };

  return {
    lineCount: normalized.length ? normalized.split("\n").length : 0,
    byteCount: Buffer.byteLength(normalized, "utf8"),
    checksumSha256: createHash("sha256").update(normalized, "utf8").digest("hex"),
    objects: {
      tables: unique(matchNames(normalized, /create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)),
      functions: unique(matchNames(normalized, /create(?:\s+or\s+replace)?\s+function\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)),
      triggers: unique(matchNames(normalized, /create\s+trigger\s+([a-zA-Z0-9_]+)/gi)),
      policies: unique(matchNames(normalized, /create\s+policy\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))/gi).map((value) => value)),
      indexes: unique(matchNames(normalized, /create\s+(?:unique\s+)?index(?:\s+if\s+not\s+exists)?\s+([a-zA-Z0-9_]+)/gi))
    },
    destructiveFlags,
    operationalFlags,
    requiresManualReview: Object.values(destructiveFlags).some(Boolean),
    containsPolicyReplacement: operationalFlags.dropPolicy && /\bcreate\s+policy\b/i.test(normalized)
  };
}

function parsePolicyNames(sql) {
  const names = [];
  for (const match of String(sql || "").matchAll(/create\s+policy\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))/gi)) {
    names.push(match[1] || match[2]);
  }
  return unique(names.filter(Boolean));
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validateStatusDocument(statusDocument, migrationPaths) {
  const failures = [];
  const entries = Array.isArray(statusDocument?.migrations) ? statusDocument.migrations : [];
  const paths = entries.map((entry) => entry.path);

  if (statusDocument?.schemaVersion !== 1) failures.push("Status document schemaVersion must be 1");
  if (statusDocument?.environment !== "production") failures.push("Status document environment must be production");
  if (new Set(paths).size !== paths.length) failures.push("Status document contains duplicate migration paths");
  if (paths.length !== migrationPaths.length || paths.some((value, index) => value !== migrationPaths[index])) {
    failures.push("Status document migration order must exactly match release-readiness.json");
  }

  for (const entry of entries) {
    if (!ALLOWED_STATUSES.has(entry.status)) failures.push(`Unsupported status ${entry.status} for ${entry.path}`);
    if (entry.status === "applied" && !(entry.verifiedAt && entry.verifiedBy && entry.evidence)) {
      failures.push(`Applied migration ${entry.path} requires verifiedAt, verifiedBy and evidence`);
    }
  }

  return failures;
}

export async function buildMigrationInventory({
  root = DEFAULT_ROOT,
  manifestPath = "config/release-readiness.json",
  statusPath = "config/production-migration-status.json"
} = {}) {
  const absoluteManifest = path.join(root, manifestPath);
  const absoluteStatus = path.join(root, statusPath);
  const manifest = await readJson(absoluteManifest);
  const migrationPaths = manifest.supabaseMigrations || [];
  const statusDocument = await readJson(absoluteStatus);
  const statusFailures = validateStatusDocument(statusDocument, migrationPaths);

  const supabaseDirectory = path.join(root, "supabase");
  const discovered = (await readdir(supabaseDirectory))
    .filter((name) => /^scorecaster_[a-z0-9_]+\.sql$/.test(name))
    .map((name) => `supabase/${name}`)
    .sort();

  const configuredSet = new Set(migrationPaths);
  const discoveredSet = new Set(discovered);
  const untrackedFiles = discovered.filter((migration) => !configuredSet.has(migration));
  const missingFiles = migrationPaths.filter((migration) => !discoveredSet.has(migration));
  const statusByPath = new Map((statusDocument.migrations || []).map((entry) => [entry.path, entry]));
  const migrations = [];

  for (const [order, migrationPath] of migrationPaths.entries()) {
    const absolutePath = path.join(root, migrationPath);
    const fileExists = await exists(absolutePath);
    const sql = fileExists ? await readFile(absolutePath, "utf8") : "";
    const analysis = fileExists ? analyzeMigrationSql(sql) : null;
    if (analysis) analysis.objects.policies = parsePolicyNames(sql);
    const recorded = statusByPath.get(migrationPath) || { status: "unverified" };

    migrations.push({
      order: order + 1,
      path: migrationPath,
      repositoryState: fileExists ? "present" : "missing",
      productionStatus: recorded.status,
      verifiedAt: recorded.verifiedAt || null,
      verifiedBy: recorded.verifiedBy || null,
      evidence: recorded.evidence || null,
      notes: recorded.notes || null,
      ...(analysis || {
        lineCount: 0,
        byteCount: 0,
        checksumSha256: null,
        objects: { tables: [], functions: [], triggers: [], policies: [], indexes: [] },
        destructiveFlags: {},
        operationalFlags: {},
        requiresManualReview: true,
        containsPolicyReplacement: false
      })
    });
  }

  const allApplied = migrations.every((migration) => migration.productionStatus === "applied");
  const manualReviewCount = migrations.filter((migration) => migration.requiresManualReview).length;

  return {
    schemaVersion: 1,
    product: manifest.product,
    environment: statusDocument.environment,
    productBoundary: manifest.productBoundary,
    generatedAt: new Date().toISOString(),
    source: {
      releaseManifest: manifestPath,
      productionStatus: statusPath
    },
    summary: {
      configuredMigrationCount: migrationPaths.length,
      discoveredMigrationCount: discovered.length,
      presentConfiguredCount: migrations.filter((migration) => migration.repositoryState === "present").length,
      appliedCount: migrations.filter((migration) => migration.productionStatus === "applied").length,
      unverifiedCount: migrations.filter((migration) => migration.productionStatus === "unverified").length,
      manualReviewCount,
      allApplied,
      repositoryComplete: missingFiles.length === 0 && untrackedFiles.length === 0,
      productionVerified: allApplied && statusFailures.length === 0
    },
    validation: {
      statusFailures,
      missingFiles,
      untrackedFiles
    },
    migrations
  };
}

export function inventoryMarkdown(inventory) {
  const rows = inventory.migrations.map((migration) => {
    const risk = migration.requiresManualReview ? "manual review" : migration.containsPolicyReplacement ? "policy replacement" : "non-destructive detected";
    return `| ${migration.order} | \`${migration.path}\` | ${migration.repositoryState} | ${migration.productionStatus} | ${risk} | \`${migration.checksumSha256 || "-"}\` |`;
  });

  return [
    "# Scorecaster production migration inventory",
    "",
    `Generated: ${inventory.generatedAt}`,
    "",
    "> Repository analysis is automatic. Production status is manual evidence and is never inferred from file presence.",
    "",
    `- Configured migrations: ${inventory.summary.configuredMigrationCount}`,
    `- Discovered migration files: ${inventory.summary.discoveredMigrationCount}`,
    `- Applied with evidence: ${inventory.summary.appliedCount}`,
    `- Unverified: ${inventory.summary.unverifiedCount}`,
    `- Repository complete: ${inventory.summary.repositoryComplete}`,
    `- Production verified: ${inventory.summary.productionVerified}`,
    "",
    "| # | Migration | Repository | Production | Static risk signal | SHA-256 |",
    "|---:|---|---|---|---|---|",
    ...rows,
    "",
    inventory.validation.untrackedFiles.length ? `Untracked files: ${inventory.validation.untrackedFiles.join(", ")}` : "Untracked files: none",
    inventory.validation.missingFiles.length ? `Missing files: ${inventory.validation.missingFiles.join(", ")}` : "Missing files: none",
    inventory.validation.statusFailures.length ? `Status validation failures: ${inventory.validation.statusFailures.join("; ")}` : "Status validation failures: none",
    ""
  ].join("\n");
}

function parseArgs(argv) {
  const options = { write: false, check: false, requireApplied: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--write") options.write = true;
    else if (value === "--check") options.check = true;
    else if (value === "--require-applied") options.requireApplied = true;
    else if (value === "--root") options.root = path.resolve(argv[++index]);
    else if (value === "--out") options.out = argv[++index];
    else if (value === "--markdown-out") options.markdownOut = argv[++index];
    else if (value === "--status") options.statusPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = options.root || DEFAULT_ROOT;
  const inventory = await buildMigrationInventory({ root, statusPath: options.statusPath });
  const failures = [
    ...inventory.validation.statusFailures,
    ...inventory.validation.missingFiles.map((item) => `Configured migration is missing: ${item}`),
    ...inventory.validation.untrackedFiles.map((item) => `Migration file is not configured: ${item}`)
  ];

  if (options.requireApplied && !inventory.summary.productionVerified) {
    failures.push("Production migrations are not fully verified as applied");
  }

  if (options.write) {
    const out = path.join(root, options.out || "artifacts/production-migration-inventory.json");
    const markdownOut = path.join(root, options.markdownOut || "artifacts/production-migration-inventory.md");
    await mkdir(path.dirname(out), { recursive: true });
    await mkdir(path.dirname(markdownOut), { recursive: true });
    await writeFile(out, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
    await writeFile(markdownOut, inventoryMarkdown(inventory), "utf8");
    console.log(`Wrote ${path.relative(root, out)} and ${path.relative(root, markdownOut)}`);
  } else {
    console.log(JSON.stringify(inventory, null, 2));
  }

  if (failures.length) {
    console.error("\nMigration inventory failed:\n");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(`\nMigration inventory passed: ${inventory.summary.configuredMigrationCount} configured files, ${inventory.summary.appliedCount} verified as applied.`);
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  await main();
}
