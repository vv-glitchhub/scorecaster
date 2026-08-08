import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { evaluateLiveDataResponseHeaders, redactCacheProbeHeaders, LIVE_DATA_CACHE_BOUNDARY_VERSION } from "../lib/live-data-cache-boundary.mjs";

const root = resolve(new URL("../", import.meta.url).pathname);
const args = process.argv.slice(2);
const policy = JSON.parse(await readFile(join(root, "config/live-data-cache-boundary.json"), "utf8"));
const release = JSON.parse(await readFile(join(root, "config/release-readiness.json"), "utf8"));
const originArg = args.find((value) => value.startsWith("--origin="));
const origin = String(originArg ? originArg.slice("--origin=".length) : release.productionBaseUrl || "").replace(/\/$/, "");
const requireProduction = args.includes("--require-production");
const writeEvidence = args.includes("--write");
const outputArg = args.find((value) => value.startsWith("--output="));
const outputPath = outputArg
  ? resolve(root, outputArg.slice("--output=".length))
  : resolve(root, "artifacts/live-data-cache-production-probe.json");

if (!/^https:\/\//i.test(origin)) {
  process.stderr.write("Production origin must be HTTPS.\n");
  process.exit(2);
}

const paths = Array.isArray(policy.productionProbe?.paths) ? policy.productionProbe.paths : [];
const observations = [];
const failures = [];

for (const path of paths) {
  const url = new URL(path, `${origin}/`);
  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const startedAt = Date.now();
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(12000)
      });
      await response.arrayBuffer();
      const headerAssessment = evaluateLiveDataResponseHeaders(response.headers, policy.productionProbe);
      const record = {
        attempt,
        status: response.status,
        durationMs: Date.now() - startedAt,
        headers: redactCacheProbeHeaders(response.headers, policy.evidence?.responseHeadersAllowlist || []),
        cacheAssessment: headerAssessment
      };
      attempts.push(record);
      if (response.status >= 500) failures.push(`${path}:http-${response.status}`);
      for (const failure of headerAssessment.failures) failures.push(`${path}:${failure}`);
    } catch (error) {
      attempts.push({
        attempt,
        status: null,
        durationMs: null,
        headers: {},
        cacheAssessment: { passed: false, failures: ["probe-request-failed"] }
      });
      failures.push(`${path}:probe-request-failed`);
    }
  }
  observations.push({ path, attempts });
}

if (!paths.length) failures.push("no-production-probe-paths-configured");

const uniqueFailures = [...new Set(failures)].sort();
const reportCore = {
  version: LIVE_DATA_CACHE_BOUNDARY_VERSION,
  origin,
  pathCount: paths.length,
  observations,
  status: uniqueFailures.length ? "blocked" : "passed",
  repositoryVerified: null,
  productionVerified: uniqueFailures.length === 0,
  failures: uniqueFailures,
  evidenceBoundary: {
    rawResponseBodyIncluded: false,
    secretValuesIncluded: false,
    personalDataIncluded: false
  },
  paperOnly: true
};
const report = {
  ...reportCore,
  evidenceId: createHash("sha256").update(JSON.stringify(reportCore)).digest("hex")
};

if (writeEvidence) {
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (requireProduction && uniqueFailures.length) process.exitCode = 1;
