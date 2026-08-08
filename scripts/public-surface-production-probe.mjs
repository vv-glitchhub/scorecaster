import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "config/release-readiness.json"), "utf8"));
const baseUrl = String(process.env.PUBLIC_SURFACE_BASE_URL || manifest.productionBaseUrl || "").replace(/\/$/, "");
const reportPath = process.env.PUBLIC_SURFACE_PRODUCTION_REPORT_PATH
  ? path.resolve(root, process.env.PUBLIC_SURFACE_PRODUCTION_REPORT_PATH)
  : null;
const expectedHost = "scorecaster.vercel.app";

const clean = (value, maximum = 240) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
const safeIso = () => new Date().toISOString();

let parsedBase;
try {
  parsedBase = new URL(baseUrl);
} catch {
  console.error("Public surface production probe requires a valid base URL.");
  process.exit(2);
}
if (parsedBase.protocol !== "https:" || parsedBase.host !== expectedHost) {
  console.error(`Public surface production probe refuses non-production host: ${parsedBase.host || "missing"}`);
  process.exit(2);
}

const publicPages = Array.isArray(manifest.publicPages) ? manifest.publicPages.map((item) => clean(item, 180)).filter(Boolean) : [];
const requiredHeaders = Object.fromEntries(Object.entries(manifest.requiredSecurityHeaders || {}).map(([key, value]) => [clean(key, 120).toLowerCase(), clean(value, 240)]));
const probes = [];
const failures = [];

for (const route of publicPages) {
  const observedAt = safeIso();
  const probeFailures = [];
  let status = null;
  let contentType = null;
  let vercelCache = null;
  let ageSeconds = null;
  const observedHeaders = {};
  try {
    const response = await fetch(new URL(route, `${baseUrl}/`), {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { "User-Agent": "Scorecaster-Production-Evidence/1.0" }
    });
    status = response.status;
    contentType = clean(response.headers.get("content-type"), 120).toLowerCase() || null;
    vercelCache = clean(response.headers.get("x-vercel-cache"), 32).toUpperCase() || null;
    const ageRaw = response.headers.get("age");
    ageSeconds = ageRaw !== null && /^\d+$/.test(ageRaw) ? Number(ageRaw) : null;
    for (const [key, expected] of Object.entries(requiredHeaders)) {
      const observed = clean(response.headers.get(key), 240);
      observedHeaders[key] = observed || null;
      if (!observed) probeFailures.push(`required-header-missing:${key}`);
      else if (observed !== expected) probeFailures.push(`required-header-mismatch:${key}`);
    }
    if (status !== 200) probeFailures.push(`http-status-not-200:${status}`);
    if (!contentType?.startsWith("text/html")) probeFailures.push("content-type-not-html");
    try { await response.body?.cancel(); } catch {}
  } catch (error) {
    probeFailures.push(`fetch-failed:${clean(error?.message, 120)}`);
  }

  failures.push(...probeFailures.map((failure) => `${route}:${failure}`));
  const probe = {
    path: route,
    observedAt,
    httpStatus: status,
    contentType,
    requiredSecurityHeaders: observedHeaders,
    ageSeconds,
    vercelCache,
    passed: probeFailures.length === 0,
    failures: probeFailures
  };
  probes.push(probe);
  console.log(JSON.stringify({
    path: probe.path,
    observedAt: probe.observedAt,
    httpStatus: probe.httpStatus,
    contentType: probe.contentType,
    requiredSecurityHeaders: probe.requiredSecurityHeaders,
    ageSeconds: probe.ageSeconds,
    vercelCache: probe.vercelCache,
    passed: probe.passed
  }));
}

const uniqueFailures = [...new Set(failures)].sort();
const report = {
  version: "scorecaster-public-surface-production-probe-v1",
  generatedAt: safeIso(),
  baseUrl,
  host: parsedBase.host,
  pageCount: publicPages.length,
  passedPageCount: probes.filter((probe) => probe.passed).length,
  requiredSecurityHeaderCount: Object.keys(requiredHeaders).length,
  probes,
  passed: uniqueFailures.length === 0 && probes.length === publicPages.length,
  failures: uniqueFailures,
  evidenceBoundary: {
    pageBodyRead: false,
    pageBodyRetained: false,
    credentialsSent: false,
    cookiesSent: false,
    authorizationSent: false,
    userDataRetained: false,
    secretValuesRetained: false
  }
};

if (reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (!report.passed) {
  console.error("Scorecaster public-surface production probe failed:");
  uniqueFailures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Scorecaster public-surface production probe passed: ${report.passedPageCount}/${report.pageCount} pages and ${report.requiredSecurityHeaderCount} required security headers per page.`);
}
