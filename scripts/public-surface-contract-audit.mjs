import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const manifest = JSON.parse(await readFile(path.join(root, "config/release-readiness.json"), "utf8"));
const nextConfig = require(path.join(root, "next.config.js"));
const reportPath = process.env.PUBLIC_SURFACE_CONTRACT_REPORT_PATH
  ? path.resolve(root, process.env.PUBLIC_SURFACE_CONTRACT_REPORT_PATH)
  : null;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
const fingerprint = (value) => sha256(JSON.stringify(stable(value)));
const clean = (value, maximum = 240) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);

async function resolvePageSource(route) {
  const segments = route === "/" ? [] : route.split("/").filter(Boolean);
  const base = path.join(root, "app", ...segments);
  for (const extension of ["js", "jsx", "ts", "tsx"]) {
    const file = path.join(base, `page.${extension}`);
    try {
      await access(file);
      return file;
    } catch {}
  }
  return null;
}

const publicPages = Array.isArray(manifest.publicPages) ? manifest.publicPages.map((item) => clean(item, 180)).filter(Boolean) : [];
const requiredHeaders = Object.fromEntries(Object.entries(manifest.requiredSecurityHeaders || {}).map(([key, value]) => [clean(key, 120).toLowerCase(), clean(value, 240)]));
const failures = [];
const pageEntries = [];
const seenPages = new Set();

for (const route of publicPages) {
  if (!route.startsWith("/")) failures.push(`${route}:public-page-path-invalid`);
  if (seenPages.has(route)) failures.push(`${route}:duplicate-public-page`);
  seenPages.add(route);
  const file = await resolvePageSource(route);
  if (!file) {
    failures.push(`${route}:page-source-missing`);
    pageEntries.push({ path: route, file: null, sourceSha256: null });
    continue;
  }
  const source = await readFile(file, "utf8");
  pageEntries.push({
    path: route,
    file: path.relative(root, file).replaceAll("\\", "/"),
    sourceSha256: sha256(source)
  });
}

let nextHeaders = [];
try {
  nextHeaders = typeof nextConfig.headers === "function" ? await nextConfig.headers() : [];
} catch (error) {
  failures.push(`next-config-headers-load-failed:${clean(error?.message, 160)}`);
}
const globalRule = nextHeaders.find((entry) => entry?.source === "/:path*");
if (!globalRule) failures.push("global-security-header-rule-missing");
const configuredHeaders = Object.fromEntries((globalRule?.headers || []).map((entry) => [clean(entry?.key, 120).toLowerCase(), clean(entry?.value, 240)]));
for (const [key, expected] of Object.entries(requiredHeaders)) {
  if (!(key in configuredHeaders)) failures.push(`required-security-header-missing:${key}`);
  else if (configuredHeaders[key] !== expected) failures.push(`required-security-header-mismatch:${key}`);
}

const nextConfigSource = await readFile(path.join(root, "next.config.js"), "utf8");
const implementationIdentity = {
  version: 1,
  publicPages: pageEntries,
  requiredSecurityHeaders: requiredHeaders,
  nextConfigSha256: sha256(nextConfigSource)
};
const implementationFingerprint = fingerprint(implementationIdentity);
const uniqueFailures = [...new Set(failures)].sort();
const report = {
  version: "scorecaster-public-surface-contract-v1",
  generatedAt: new Date().toISOString(),
  implementationFingerprint,
  implementationIdentity,
  pageCount: publicPages.length,
  resolvedPageCount: pageEntries.filter((entry) => entry.sourceSha256).length,
  requiredSecurityHeaderCount: Object.keys(requiredHeaders).length,
  configuredSecurityHeaders: Object.fromEntries(Object.keys(requiredHeaders).map((key) => [key, configuredHeaders[key] ?? null])),
  passed: uniqueFailures.length === 0,
  failures: uniqueFailures,
  safety: {
    staticOnly: true,
    productionFetched: false,
    pageBodyRetained: false,
    credentialsUsed: false,
    userDataRead: false,
    realMoneyExecution: false
  }
};

if (reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (uniqueFailures.length) {
  console.error("Scorecaster public-surface contract audit failed:");
  uniqueFailures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Public surface implementation fingerprint: ${implementationFingerprint}`);
  process.exitCode = 1;
} else {
  console.log(`Scorecaster public-surface contract audit passed: ${publicPages.length}/${publicPages.length} pages and ${Object.keys(requiredHeaders).length}/${Object.keys(requiredHeaders).length} required security headers.`);
  console.log(`Public surface implementation fingerprint: ${implementationFingerprint}`);
}
