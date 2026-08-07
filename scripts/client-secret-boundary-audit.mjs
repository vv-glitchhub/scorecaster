import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(await readFile(path.join(root, "config/production-security.json"), "utf8"));
const reportPath = path.resolve(root, process.env.CLIENT_SECRET_BOUNDARY_REPORT_PATH || "artifacts/client-secret-boundary.json");
const requireWebBuild = process.argv.includes("--require-web-build");
const textExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json"]);
const secretNames = [...(policy.serverOnlyRequired || []), ...(policy.serverOnlyConditional || [])];
const secretValuePatterns = [
  /\bsk-[A-Za-z0-9_-]{24,}\b/g,
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
];

async function exists(target) {
  try { return (await stat(target)).isDirectory(); } catch { return false; }
}

async function files(directory) {
  if (!await exists(directory)) return [];
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await files(absolute));
    else if (textExtensions.has(path.extname(entry.name))) found.push(absolute);
  }
  return found;
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

async function scan(group, fileList, { serverNameSeverity = "warning" } = {}) {
  const violations = [];
  const warnings = [];
  for (const file of fileList) {
    const content = await readFile(file, "utf8").catch(() => "");
    for (const name of secretNames) {
      if (content.includes(name)) {
        const finding = { group, file: relative(file), type: "server-only-variable-name", name };
        if (serverNameSeverity === "error") violations.push(finding);
        else warnings.push(finding);
      }
      for (const prefix of policy.forbiddenClientPrefixes || []) {
        const alias = `${prefix}${name}`;
        if (content.includes(alias)) violations.push({ group, file: relative(file), type: "forbidden-public-alias", name: alias });
      }
    }
    for (const pattern of secretValuePatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) violations.push({ group, file: relative(file), type: "secret-value-pattern", name: "redacted-pattern" });
    }
  }
  return { violations, warnings };
}

const webRoot = path.join(root, ".next", "static");
const mobileRoot = path.join(root, "mobile", "src");
const webFiles = await files(webRoot);
const mobileFiles = await files(mobileRoot);

// A literal server environment-variable name in a generated Next.js chunk is
// not itself a secret. Next.js does not expose non-NEXT_PUBLIC values to the
// browser. We still report those names for review, but fail the web boundary on
// actual secret-shaped values or on a forbidden public alias. Mobile source is
// stricter: server-only names have no legitimate role in native client source.
const webScan = await scan("web-static", webFiles, { serverNameSeverity: "warning" });
const mobileScan = await scan("mobile-source", mobileFiles, { serverNameSeverity: "error" });
const violations = [...webScan.violations, ...mobileScan.violations];
const warnings = [...webScan.warnings, ...mobileScan.warnings];

const report = {
  version: "scorecaster-client-secret-boundary-v1.1",
  generatedAt: new Date().toISOString(),
  webBundleAvailable: webFiles.length > 0,
  webFilesScanned: webFiles.length,
  mobileSourceFilesScanned: mobileFiles.length,
  serverOnlyNamesChecked: secretNames,
  violationCount: violations.length,
  warningCount: warnings.length,
  violations,
  warnings,
  passed: violations.length === 0 && (!requireWebBuild || webFiles.length > 0),
  policy: {
    webServerOnlyName: "report-only",
    webForbiddenPublicAlias: "fail",
    webSecretValuePattern: "fail",
    mobileServerOnlyName: "fail",
    mobileForbiddenPublicAlias: "fail",
    mobileSecretValuePattern: "fail"
  },
  limitations: {
    signedMobileBundleInspected: false,
    signedMobileBundleRequiresPhysicalReleaseStep: true,
    secretValuesLoadedForComparison: false
  },
  safety: {
    secretValuesIncluded: false,
    paperOnly: true,
    realMoneyExecution: false
  }
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (requireWebBuild && webFiles.length === 0) {
  console.error("Client secret boundary audit failed: .next/static is missing. Run npm run build first.");
  process.exitCode = 1;
} else if (violations.length) {
  console.error(`Client secret boundary audit failed: ${violations.length} client-bundle/source violations.`);
  violations.forEach((item) => console.error(`- ${item.group}:${item.file}: ${item.type} ${item.name}`));
  process.exitCode = 1;
} else {
  console.log(`Client secret boundary audit passed: ${webFiles.length} web static files and ${mobileFiles.length} mobile source files checked. No secret-shaped values or forbidden public aliases found; mobile source contains no server-only names.`);
  if (warnings.length) console.log(`Review note: ${warnings.length} generated web-chunk server-only variable-name occurrence(s) were recorded as non-secret metadata warnings.`);
}
