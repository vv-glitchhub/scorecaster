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

async function scan(group, fileList) {
  const violations = [];
  for (const file of fileList) {
    const content = await readFile(file, "utf8").catch(() => "");
    for (const name of secretNames) {
      if (content.includes(name)) violations.push({ group, file: relative(file), type: "server-only-variable-name", name });
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
  return violations;
}

const webRoot = path.join(root, ".next", "static");
const mobileRoot = path.join(root, "mobile", "src");
const webFiles = await files(webRoot);
const mobileFiles = await files(mobileRoot);
const violations = [
  ...await scan("web-static", webFiles),
  ...await scan("mobile-source", mobileFiles)
];

const report = {
  version: "scorecaster-client-secret-boundary-v1",
  generatedAt: new Date().toISOString(),
  webBundleAvailable: webFiles.length > 0,
  webFilesScanned: webFiles.length,
  mobileSourceFilesScanned: mobileFiles.length,
  serverOnlyNamesChecked: secretNames,
  violationCount: violations.length,
  violations,
  passed: violations.length === 0 && (!requireWebBuild || webFiles.length > 0),
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
  console.log(`Client secret boundary audit passed: ${webFiles.length} web static files and ${mobileFiles.length} mobile source files checked. No server-only variable names or secret patterns found.`);
}
