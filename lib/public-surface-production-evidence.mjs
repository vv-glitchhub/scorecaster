export const PUBLIC_SURFACE_PRODUCTION_EVIDENCE_VERSION = "scorecaster-public-surface-production-evidence-v1";

const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

const finite = (value) => value === null || value === undefined || value === ""
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const integer = (value) => {
  const number = finite(value);
  return number !== null && Number.isInteger(number) ? number : null;
};
const validFingerprint = (value) => /^[0-9a-f]{64}$/i.test(clean(value, 80));
const validCommit = (value) => /^[0-9a-f]{7,64}$/i.test(clean(value, 80));
const safeIso = (value) => {
  const text = clean(value, 64);
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const safeEvidenceRef = (value) => {
  const text = clean(value, 240);
  if (!text) return null;
  if (/password|passwd|secret|token=|apikey|api_key|authorization|bearer\s|service[_ -]?role|private[_ -]?key|cookie=/i.test(text)) return null;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.username || url.password || url.search) return null;
      return url.toString().slice(0, 240);
    } catch {
      return null;
    }
  }
  return /^[A-Za-z0-9._:/#@+-]{1,240}$/.test(text) ? text : null;
};

function expectedPages(manifest = {}) {
  return (Array.isArray(manifest.publicPages) ? manifest.publicPages : [])
    .map((item) => clean(item, 180))
    .filter((item) => item.startsWith("/"));
}

function requiredHeaders(manifest = {}) {
  return Object.fromEntries(Object.entries(manifest.requiredSecurityHeaders || {}).map(([key, value]) => [
    clean(key, 120).toLowerCase(),
    clean(value, 240)
  ]).filter(([key, value]) => key && value));
}

export function buildTrustedPublicSurfaceEvidence({
  trustedDocument = {},
  implementation = {},
  manifest = {}
} = {}) {
  const failures = [];
  const expected = expectedPages(manifest);
  const expectedSet = new Set(expected);
  const expectedHeaders = requiredHeaders(manifest);
  const currentFingerprint = validFingerprint(implementation?.implementationFingerprint)
    ? clean(implementation.implementationFingerprint, 80).toLowerCase()
    : null;
  const evidenceFingerprint = validFingerprint(trustedDocument?.implementationFingerprint)
    ? clean(trustedDocument.implementationFingerprint, 80).toLowerCase()
    : null;

  if (trustedDocument?.schemaVersion !== 1) failures.push("invalid-public-surface-evidence-schema-version");
  if (trustedDocument?.product !== "Scorecaster") failures.push("invalid-public-surface-evidence-product");
  if (trustedDocument?.evidenceType !== "github-actions-production-public-surface-probe-v1") failures.push("unsupported-public-surface-evidence-type");
  if (implementation?.schemaVersion !== 1) failures.push("invalid-public-surface-implementation-schema-version");
  if (implementation?.contractVersion !== "scorecaster-public-surface-contract-v1") failures.push("unsupported-public-surface-contract-version");
  if (!currentFingerprint) failures.push("current-public-surface-implementation-fingerprint-invalid");
  if (!evidenceFingerprint) failures.push("public-surface-evidence-implementation-fingerprint-invalid");
  if (currentFingerprint && evidenceFingerprint && currentFingerprint !== evidenceFingerprint) failures.push("public-surface-production-evidence-stale");
  if (integer(implementation?.pageCount) !== expected.length) failures.push("public-surface-page-count-mismatch");
  if (integer(implementation?.requiredSecurityHeaderCount) !== Object.keys(expectedHeaders).length) failures.push("public-surface-header-count-mismatch");

  const deployment = trustedDocument?.verifiedDeployment || {};
  if (deployment.environment !== "production") failures.push("public-surface-evidence-not-production");
  if (!clean(deployment.deploymentId, 120).startsWith("dpl_")) failures.push("public-surface-deployment-id-invalid");
  if (!validCommit(deployment.commitSha)) failures.push("public-surface-verified-commit-invalid");
  if (clean(deployment.host, 240).toLowerCase() !== "scorecaster.vercel.app") failures.push("public-surface-production-host-invalid");
  const observedAt = safeIso(trustedDocument?.observedAt);
  if (!observedAt) failures.push("public-surface-evidence-observed-at-invalid");
  const evidenceRef = safeEvidenceRef(trustedDocument?.evidenceRef);
  if (!evidenceRef) failures.push("public-surface-evidence-reference-invalid-or-secret-bearing");
  if (integer(trustedDocument?.workflowRunId) === null) failures.push("public-surface-workflow-run-id-invalid");
  if (integer(trustedDocument?.artifactId) === null) failures.push("public-surface-artifact-id-invalid");

  for (const flag of [
    "pageBodyRead",
    "pageBodyRetained",
    "credentialsSent",
    "cookiesSent",
    "authorizationSent",
    "userDataRetained",
    "secretValuesRetained"
  ]) {
    if (trustedDocument?.[flag] !== false) failures.push(`public-surface-${flag}-must-be-false`);
  }

  const probes = Array.isArray(trustedDocument?.probes) ? trustedDocument.probes : [];
  const seen = new Set();
  const normalized = [];
  for (const probe of probes) {
    const path = clean(probe?.path, 180);
    const probeObservedAt = safeIso(probe?.observedAt);
    const httpStatus = integer(probe?.httpStatus);
    const contentType = clean(probe?.contentType, 120).toLowerCase();
    const ageSeconds = finite(probe?.ageSeconds);
    const vercelCache = clean(probe?.vercelCache, 32).toUpperCase();
    const observedHeaders = Object.fromEntries(Object.entries(probe?.requiredSecurityHeaders || {}).map(([key, value]) => [clean(key, 120).toLowerCase(), clean(value, 240)]));
    const probeFailures = [];

    if (!expectedSet.has(path)) probeFailures.push("unexpected-public-page");
    if (seen.has(path)) probeFailures.push("duplicate-public-page-probe");
    seen.add(path);
    if (!probeObservedAt) probeFailures.push("public-page-probe-observed-at-invalid");
    if (httpStatus !== 200) probeFailures.push("public-page-http-status-not-200");
    if (!contentType.startsWith("text/html")) probeFailures.push("public-page-content-type-not-html");
    if (ageSeconds === null || ageSeconds < 0 || !Number.isInteger(ageSeconds)) probeFailures.push("public-page-age-invalid");
    if (!vercelCache) probeFailures.push("public-page-cache-state-missing");
    if (vercelCache === "STALE") probeFailures.push("public-page-cache-state-stale");
    for (const [key, expectedValue] of Object.entries(expectedHeaders)) {
      const actual = observedHeaders[key];
      if (!actual) probeFailures.push(`public-page-header-missing:${key}`);
      else if (actual !== expectedValue) probeFailures.push(`public-page-header-mismatch:${key}`);
    }

    failures.push(...probeFailures.map((failure) => `${path || "unknown"}:${failure}`));
    normalized.push({
      path,
      observedAt: probeObservedAt,
      httpStatus,
      contentType,
      requiredSecurityHeaders: observedHeaders,
      ageSeconds,
      vercelCache,
      passed: probeFailures.length === 0
    });
  }

  for (const page of expected) {
    if (!seen.has(page)) failures.push(`${page}:missing-public-page-probe`);
  }
  if (probes.length !== expected.length) failures.push("public-surface-probe-count-mismatch");
  const latestProbeAt = normalized.map((probe) => probe.observedAt).filter(Boolean).sort().at(-1) || null;
  if (observedAt && latestProbeAt && Date.parse(observedAt) < Date.parse(latestProbeAt)) failures.push("public-surface-evidence-observed-at-before-latest-probe");

  const uniqueFailures = [...new Set(failures)].sort();
  const passed = uniqueFailures.length === 0;
  const publicSurfaceEvidence = Object.fromEntries(expected.map((page) => {
    const probe = normalized.find((item) => item.path === page);
    return [page, {
      status: passed && probe?.passed ? "passed" : "unverified",
      observedAt: passed && probe?.passed ? probe.observedAt : null,
      httpStatus: passed && probe?.passed ? probe.httpStatus : null,
      evidenceRef: passed && probe?.passed ? evidenceRef : null
    }];
  }));

  return {
    ok: passed,
    version: PUBLIC_SURFACE_PRODUCTION_EVIDENCE_VERSION,
    status: passed ? "passed" : "unverified",
    implementationFingerprint: currentFingerprint,
    evidenceImplementationFingerprint: evidenceFingerprint,
    pageCount: expected.length,
    passedPageCount: passed ? expected.length : 0,
    requiredSecurityHeaderCount: Object.keys(expectedHeaders).length,
    observedAt: passed ? observedAt : null,
    verifiedDeployment: passed ? {
      deploymentId: clean(deployment.deploymentId, 120),
      commitSha: clean(deployment.commitSha, 80).toLowerCase(),
      environment: "production",
      host: "scorecaster.vercel.app"
    } : null,
    workflowRunId: integer(trustedDocument?.workflowRunId),
    artifactId: integer(trustedDocument?.artifactId),
    probes: normalized,
    publicSurfaceEvidence,
    failures: uniqueFailures,
    evidenceBoundary: {
      pageBodyRead: false,
      pageBodyRetained: false,
      credentialsSent: false,
      cookiesSent: false,
      authorizationSent: false,
      userDataRetained: false,
      secretValuesRetained: false
    },
    paperOnly: true
  };
}
