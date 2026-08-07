import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const artifacts = [];
let reportPath = path.resolve(root, "artifacts/signed-bundle-audit.json");
let requireArtifact = false;

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--artifact") artifacts.push(path.resolve(process.cwd(), args[++index] || ""));
  else if (args[index] === "--report") reportPath = path.resolve(process.cwd(), args[++index] || "");
  else if (args[index] === "--require-artifact") requireArtifact = true;
  else throw new Error(`Unknown argument: ${args[index]}`);
}

const serverOnlyNames = [
  ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
  ["ODDS", "API", "KEY"].join("_"),
  ["SPORTSGAMEODDS", "API", "KEY"].join("_"),
  ["OPENAI", "API", "KEY"].join("_"),
  ["AGENT", "DECISION", "SIGNING", "KEY"].join("_"),
  ["CRON", "SECRET"].join("_"),
  ["NEWS", "API", "KEY"].join("_"),
  ["SPORTSDATA", "API", "KEY"].join("_"),
  ["LINEUP", "API", "KEY"].join("_"),
  ["SPORTS", "CONTEXT", "API", "KEY"].join("_"),
  ["SPORTS", "ANALYTICS", "API", "KEY"].join("_"),
  ["COLLECTOR", "JSON", "API", "KEY"].join("_")
];
const forbiddenAliases = serverOnlyNames.flatMap((name) => [`EXPO_PUBLIC_${name}`, `NEXT_PUBLIC_${name}`]);
const secretPatterns = [
  { id: "openai-style-secret", pattern: /\bsk-[A-Za-z0-9_-]{24,}\b/g },
  { id: "supabase-secret-key", pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
  { id: "private-key-block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g }
];
const likelyBundleEntry = /(?:^|\/)(?:main\.jsbundle|index\.(?:android|ios)\.bundle|[^/]+\.(?:js|json|xml|plist|txt|html|bundle|map|config|properties))$/i;
const maxEntryBytes = 8 * 1024 * 1024;

async function exists(target) {
  try { return await stat(target); } catch { return null; }
}

async function sha256File(file) {
  const { createReadStream } = await import("node:fs");
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function inferPlatform(target) {
  const lower = target.toLowerCase();
  if (lower.endsWith(".ipa")) return "ios";
  if (lower.endsWith(".apk") || lower.endsWith(".aab")) return "android";
  return "unknown";
}

function scanText(text, location) {
  const violations = [];
  for (const alias of forbiddenAliases) {
    if (text.includes(alias)) violations.push({ type: "forbidden-public-server-secret-alias", location, indicator: alias });
  }
  for (const name of serverOnlyNames) {
    if (text.includes(name)) violations.push({ type: "server-only-variable-name", location, indicator: name });
  }
  for (const { id, pattern } of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) violations.push({ type: "secret-value-pattern", location, indicator: id });
  }
  return violations;
}

async function directoryFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await directoryFiles(absolute));
    else if (entry.isFile()) found.push(absolute);
  }
  return found;
}

async function scanDirectory(directory) {
  const files = await directoryFiles(directory);
  const violations = [];
  let scannedEntries = 0;
  let skippedLargeEntries = 0;
  for (const file of files) {
    const info = await stat(file);
    if (info.size > maxEntryBytes) { skippedLargeEntries += 1; continue; }
    if (!likelyBundleEntry.test(file.replaceAll("\\", "/"))) continue;
    const bytes = await readFile(file);
    const text = bytes.toString("utf8");
    violations.push(...scanText(text, path.relative(directory, file).replaceAll("\\", "/")));
    scannedEntries += 1;
  }
  return { scannedEntries, skippedLargeEntries, violations, archiveEntries: files.length };
}

function unzipList(archive) {
  const result = spawnSync("unzip", ["-Z1", archive], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error("Unable to inspect signed archive with unzip");
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function unzipEntry(archive, entry) {
  const result = spawnSync("unzip", ["-p", archive, entry], { encoding: null, maxBuffer: maxEntryBytes + 1024 });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

async function scanArchive(archive) {
  const entries = unzipList(archive);
  const violations = [];
  let scannedEntries = 0;
  let skippedLargeEntries = 0;
  for (const entry of entries) {
    if (!likelyBundleEntry.test(entry)) continue;
    const bytes = unzipEntry(archive, entry);
    if (!bytes) { skippedLargeEntries += 1; continue; }
    violations.push(...scanText(bytes.toString("utf8"), entry));
    scannedEntries += 1;
  }
  return { scannedEntries, skippedLargeEntries, violations, archiveEntries: entries.length };
}

const artifactReports = [];
const failures = [];
for (const target of artifacts) {
  const info = await exists(target);
  if (!info) {
    failures.push(`artifact-not-found:${path.basename(target)}`);
    continue;
  }
  try {
    const scan = info.isDirectory() ? await scanDirectory(target) : await scanArchive(target);
    const report = {
      artifact: path.basename(target),
      platform: inferPlatform(target),
      kind: info.isDirectory() ? "extracted-directory" : "signed-archive",
      sha256: info.isFile() ? await sha256File(target) : null,
      archiveEntries: scan.archiveEntries,
      scannedEntries: scan.scannedEntries,
      skippedLargeEntries: scan.skippedLargeEntries,
      violationCount: scan.violations.length,
      violations: scan.violations,
      passed: scan.violations.length === 0 && scan.scannedEntries > 0
    };
    if (!report.passed) failures.push(`${report.artifact}:${report.violationCount ? "secret-boundary-violation" : "no-scannable-bundle-entries"}`);
    artifactReports.push(report);
  } catch (error) {
    failures.push(`${path.basename(target)}:${String(error?.message || error).slice(0, 160)}`);
  }
}

const platforms = new Set(artifactReports.filter((item) => item.passed).map((item) => item.platform));
const report = {
  version: "scorecaster-signed-mobile-bundle-audit-v1",
  generatedAt: new Date().toISOString(),
  status: artifacts.length === 0 ? "unverified" : failures.length ? "failed" : "passed",
  artifactsProvided: artifacts.length,
  iosArtifactPassed: platforms.has("ios"),
  androidArtifactPassed: platforms.has("android"),
  bothPlatformsPassed: platforms.has("ios") && platforms.has("android"),
  serverOnlyNamesChecked: serverOnlyNames,
  forbiddenPublicAliasesChecked: forbiddenAliases,
  artifactReports,
  failures,
  limitations: {
    artifactAuthenticityVerifiedByStore: false,
    signingCertificateChainVerified: false,
    runtimeNetworkTrafficInspected: false,
    physicalDeviceBehaviorVerified: false
  },
  safety: {
    secretValuesIncludedInReport: false,
    extractedSecretSnippetsIncluded: false,
    accessTokensIncluded: false,
    signingCredentialsIncluded: false,
    paperOnly: true,
    realMoneyExecution: false
  }
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (requireArtifact && artifacts.length === 0) {
  console.error("Signed bundle audit requires at least one --artifact path.");
  process.exitCode = 1;
} else if (failures.length) {
  console.error(`Signed bundle audit failed with ${failures.length} failure(s).`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else if (artifacts.length === 0) {
  console.log("Signed bundle audit is unverified: no IPA/APK/AAB artifact was supplied. Repository CI must not treat this as physical release proof.");
} else {
  console.log(`Signed bundle audit passed for ${artifactReports.length} supplied artifact(s).`);
  if (!report.bothPlatformsPassed) console.log("Both-platform release evidence remains incomplete until one signed iOS and one signed Android artifact pass.");
}
