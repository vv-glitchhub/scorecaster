import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
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
const serviceWorkerPolicy = policy.serviceWorker || {};

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

const registrationPath = String(serviceWorkerPolicy.registrationPath || "");
const workerPath = String(serviceWorkerPolicy.workerPath || "");
const registrationText = registrationPath ? await readFile(join(root, registrationPath), "utf8").catch(() => "") : "";
const workerText = workerPath ? await readFile(join(root, workerPath), "utf8").catch(() => "") : "";
const unexpectedCapabilities = [];

for (const path of scannedFiles) {
  const text = await readFile(join(root, path), "utf8");
  const lower = text.toLowerCase();

  if (path.startsWith("app/api/") && /["']cache-control["']\s*:\s*["'][^"']*\b(?:public|s-maxage|stale-while-revalidate)\b/i.test(text)) {
    unexpectedCapabilities.push({ path, pattern: "cacheable-api-response-header" });
  }

  for (const pattern of serviceWorkerPolicy.forbiddenGeneralPatterns || []) {
    if (lower.includes(String(pattern).toLowerCase())) unexpectedCapabilities.push({ path, pattern });
  }

  if (path !== registrationPath && lower.includes("navigator.serviceworker.register")) {
    unexpectedCapabilities.push({ path, pattern: "unexpected-service-worker-registration" });
  }

  if (path !== workerPath) {
    for (const pattern of ["self.addeventlistener(\"fetch\"", "self.addeventlistener('fetch'", "caches.open(", "caches.match("]) {
      if (lower.includes(pattern)) unexpectedCapabilities.push({ path, pattern });
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
if (serviceWorkerPolicy.mode !== "reviewed-network-only-api-bypass") failures.push("unexpected-service-worker-policy");
if (!registrationText) failures.push("service-worker-registration-source-missing");
if (!workerText) failures.push("service-worker-source-missing");
if (!hasApiSource) failures.push("missing-global-api-cache-header-rule");
for (const token of headerTokensPresent) {
  if (!token.present) failures.push(`missing-api-cache-control-token:${token.token}`);
}

const expectedRegistration = `navigator.serviceWorker.register("${serviceWorkerPolicy.scriptUrl}")`;
if (registrationText && !registrationText.includes(expectedRegistration)) failures.push("reviewed-service-worker-registration-missing");

const requiredBypass = String(serviceWorkerPolicy.requiredApiBypass || "");
const bypassIndex = requiredBypass ? workerText.indexOf(requiredBypass) : -1;
const firstRespondWithIndex = workerText.indexOf("event.respondWith(");
if (bypassIndex < 0) failures.push("api-network-only-bypass-missing");
if (firstRespondWithIndex < 0) failures.push("service-worker-fetch-interception-missing");
if (bypassIndex >= 0 && firstRespondWithIndex >= 0 && bypassIndex > firstRespondWithIndex) {
  failures.push("api-bypass-occurs-after-fetch-interception");
}
for (const guard of serviceWorkerPolicy.requiredGuards || []) {
  if (!workerText.includes(guard)) failures.push(`service-worker-guard-missing:${guard}`);
}
if (!/self\.addEventListener\(["']fetch["']/.test(workerText)) failures.push("service-worker-fetch-handler-missing");

const offlineAssetsMatch = workerText.match(/const\s+OFFLINE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (!offlineAssetsMatch) failures.push("offline-asset-allowlist-missing");
else if (/["']\/api\//.test(offlineAssetsMatch[1])) failures.push("api-route-present-in-offline-assets");

for (const match of unexpectedCapabilities) {
  failures.push(`unexpected-cache-capability:${match.path}:${match.pattern}`);
}

if (policy.releaseGate?.id !== "live-data-pwa-cache-boundary" || policy.releaseGate?.blocking !== true) {
  failures.push("live-data-cache-release-gate-invalid");
}
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
    mode: serviceWorkerPolicy.mode,
    registrationPath,
    workerPath,
    reviewedScriptUrl: serviceWorkerPolicy.scriptUrl || null,
    apiBypassPresent: bypassIndex >= 0,
    apiBypassBeforeInterception: bypassIndex >= 0 && firstRespondWithIndex >= 0 && bypassIndex < firstRespondWithIndex,
    offlineAssetAllowlistPresent: Boolean(offlineAssetsMatch),
    scannedFileCount: scannedFiles.length,
    unexpectedCapabilityCount: unexpectedCapabilities.length,
    unexpectedCapabilities
  },
  releaseGate: {
    id: policy.releaseGate?.id || null,
    blocking: policy.releaseGate?.blocking === true,
    productionEvidenceRequired: true
  },
  evidenceBoundary: {
    rawResponseBodyIncluded: false,
    secretValuesIncluded: false,
    personalDataIncluded: false
  },
  failures: [...new Set(failures)].sort(),
  paperOnly: true
};

if (writeEvidence) {
  await mkdir(resolve(evidencePath, ".."), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
