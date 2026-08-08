import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(new URL("../", import.meta.url).pathname);
const args = new Set(process.argv.slice(2));
const writeEvidence = args.has("--write");
const evidencePathArg = process.argv.find((value) => value.startsWith("--output="));
const evidencePath = evidencePathArg
  ? resolve(root, evidencePathArg.slice("--output=".length))
  : resolve(root, "artifacts/live-data-cache-boundary.json");

const policy = JSON.parse(await readFile(join(root, "config/live-data-cache-boundary.json"), "utf8"));
const nextConfigText = await readFile(join(root, "next.config.js"), "utf8");

const sourceRoots = ["app", "components", "lib", "public", "mobile/src"];
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

async function filesUnder(path) {
  const absolute = join(root, path);
  try {
    const entries = await readdir(absolute, { withFileTypes: true });
    const nested = [];
    for (const entry of entries) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) nested.push(...await filesUnder(child));
      else if (sourceExtensions.has(extname(entry.name))) nested.push(child);
    }
    return nested;
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

const scannedFiles = [];
for (const sourceRoot of sourceRoots) scannedFiles.push(...await filesUnder(sourceRoot));
scannedFiles.sort();

const forbiddenMatches = [];
for (const path of scannedFiles) {
  const text = await readFile(join(root, path), "utf8");
  for (const pattern of policy.serviceWorker.forbiddenSourcePatterns) {
    if (text.toLowerCase().includes(String(pattern).toLowerCase())) {
      forbiddenMatches.push({ path, pattern });
    }
  }
}

const headerRule = policy.apiHeaderRule;
const hasApiSource = nextConfigText.includes(`source: "${headerRule.source}"`)
  || nextConfigText.includes(`source: '${headerRule.source}'`);
const cacheControlLine = nextConfigText
  .split(/\r?\n/)
  .find((line) => /key:\s*["']Cache-Control["']/.test(line));
const headerTokensPresent = headerRule.requiredCacheControlTokens.map((token) => ({
  token,
  present: Boolean(cacheControlLine && cacheControlLine.toLowerCase().includes(token.toLowerCase()))
}));

const failures = [];
if (policy.version !== 1) failures.push("unsupported-policy-version");
if (policy.policy !== "network-only-live-api") failures.push("unexpected-live-api-policy");
if (policy.serviceWorker.mode !== "disabled-until-reviewed-network-only") failures.push("unexpected-service-worker-policy");
if (!hasApiSource) failures.push("missing-global-api-cache-header-rule");
for (const token of headerTokensPresent) {
  if (!token.present) failures.push(`missing-api-cache-control-token:${token.token}`);
}
for (const match of forbiddenMatches) failures.push(`service-worker-cache-capability:${match.path}:${match.pattern}`);
if (policy.productBoundary?.paperOnly !== true
  || policy.productBoundary?.bookmakerLogin !== false
  || policy.productBoundary?.deposits !== false
  || policy.productBoundary?.withdrawals !== false
  || policy.productBoundary?.cashOut !== false
  || policy.productBoundary?.realMoneyExecution !== false) {
  failures.push("product-boundary-invalid");
}

const policyFingerprint = createHash("sha256")
  .update(JSON.stringify(policy))
  .digest("hex");
const report = {
  version: "scorecaster-live-data-cache-boundary-v1",
  status: failures.length ? "blocked" : "passed",
  repositoryVerified: failures.length === 0,
  productionVerified: false,
  policyFingerprint,
  apiHeaderRule: {
    source: headerRule.source,
    sourceRulePresent: hasApiSource,
    requiredTokens: headerTokensPresent
  },
  serviceWorkerBoundary: {
    mode: policy.serviceWorker.mode,
    scannedFileCount: scannedFiles.length,
    forbiddenCapabilityCount: forbiddenMatches.length,
    forbiddenCapabilities: forbiddenMatches
  },
  evidenceBoundary: {
    rawResponseBodyIncluded: false,
    secretValuesIncluded: false,
    personalDataIncluded: false
  },
  failures,
  paperOnly: true
};

if (writeEvidence) {
  await mkdir(resolve(evidencePath, ".."), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
