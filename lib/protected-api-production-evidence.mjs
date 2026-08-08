export const PROTECTED_API_PRODUCTION_EVIDENCE_VERSION = "scorecaster-protected-api-production-evidence-v1";

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

function expectedApis(manifest = {}) {
  return (Array.isArray(manifest.protectedApis) ? manifest.protectedApis : [])
    .map((api) => ({
      path: clean(api?.path, 180),
      method: clean(api?.method, 12).toUpperCase(),
      allowedStatuses: Array.isArray(api?.allowedStatuses)
        ? api.allowedStatuses.map(integer).filter((value) => value !== null)
        : []
    }))
    .filter((api) => api.path.startsWith("/api/") && api.method);
}

export function buildTrustedProtectedApiProbeEvidence({
  trustedDocument = {},
  implementation = {},
  manifest = {}
} = {}) {
  const failures = [];
  const expected = expectedApis(manifest);
  const expectedByPath = new Map(expected.map((api) => [api.path, api]));
  const currentFingerprint = validFingerprint(implementation?.implementationFingerprint)
    ? clean(implementation.implementationFingerprint, 80).toLowerCase()
    : null;
  const evidenceFingerprint = validFingerprint(trustedDocument?.implementationFingerprint)
    ? clean(trustedDocument.implementationFingerprint, 80).toLowerCase()
    : null;

  if (trustedDocument?.schemaVersion !== 1) failures.push("invalid-protected-api-evidence-schema-version");
  if (trustedDocument?.product !== "Scorecaster") failures.push("invalid-protected-api-evidence-product");
  if (trustedDocument?.evidenceType !== "vercel-production-unauthenticated-protected-api-probes-v1") failures.push("unsupported-protected-api-evidence-type");
  if (implementation?.schemaVersion !== 1) failures.push("invalid-protected-api-implementation-schema-version");
  if (implementation?.contractVersion !== "scorecaster-protected-api-contract-v1") failures.push("unsupported-protected-api-contract-version");
  if (!currentFingerprint) failures.push("current-protected-api-implementation-fingerprint-invalid");
  if (!evidenceFingerprint) failures.push("protected-api-evidence-implementation-fingerprint-invalid");
  if (currentFingerprint && evidenceFingerprint && currentFingerprint !== evidenceFingerprint) failures.push("protected-api-production-evidence-stale");
  if (integer(implementation?.apiCount) !== expected.length) failures.push("protected-api-implementation-count-mismatch");

  const deployment = trustedDocument?.verifiedDeployment || {};
  if (deployment.environment !== "production") failures.push("protected-api-evidence-not-production");
  if (!clean(deployment.deploymentId, 120).startsWith("dpl_")) failures.push("protected-api-deployment-id-invalid");
  if (!validCommit(deployment.commitSha)) failures.push("protected-api-verified-commit-invalid");
  if (clean(deployment.host, 240).toLowerCase() !== "scorecaster.vercel.app") failures.push("protected-api-production-host-invalid");
  const observedAt = safeIso(trustedDocument?.observedAt);
  if (!observedAt) failures.push("protected-api-evidence-observed-at-invalid");
  const evidenceRef = safeEvidenceRef(trustedDocument?.evidenceRef);
  if (!evidenceRef) failures.push("protected-api-evidence-reference-invalid-or-secret-bearing");

  if (trustedDocument?.sessionCredentialSent !== false) failures.push("session-credential-must-not-be-sent");
  if (trustedDocument?.bearerTokenSent !== false) failures.push("bearer-token-must-not-be-sent");
  if (trustedDocument?.rawResponseBodyIncluded !== false) failures.push("protected-api-raw-response-body-must-not-be-retained");
  if (trustedDocument?.secretValuesIncluded !== false) failures.push("protected-api-secret-values-must-not-be-retained");
  if (trustedDocument?.userDataIncluded !== false) failures.push("protected-api-user-data-must-not-be-retained");
  if (trustedDocument?.requestIdentifiersIncluded !== false) failures.push("protected-api-request-identifiers-must-not-be-retained");

  const probes = Array.isArray(trustedDocument?.probes) ? trustedDocument.probes : [];
  const seen = new Set();
  const normalized = [];
  for (const probe of probes) {
    const path = clean(probe?.path, 180);
    const method = clean(probe?.method, 12).toUpperCase();
    const probeObservedAt = safeIso(probe?.observedAt);
    const httpStatus = integer(probe?.httpStatus);
    const cacheControl = clean(probe?.cacheControl, 160).toLowerCase();
    const ageSeconds = finite(probe?.ageSeconds);
    const vercelCache = clean(probe?.vercelCache, 32).toUpperCase();
    const expectedApi = expectedByPath.get(path);
    const probeFailures = [];

    if (!expectedApi) probeFailures.push("unexpected-protected-api-path");
    if (seen.has(path)) probeFailures.push("duplicate-protected-api-probe");
    seen.add(path);
    if (expectedApi && method !== expectedApi.method) probeFailures.push("protected-api-method-mismatch");
    if (!probeObservedAt) probeFailures.push("protected-api-probe-observed-at-invalid");
    if (expectedApi && !expectedApi.allowedStatuses.includes(httpStatus)) probeFailures.push("protected-api-http-status-not-allowed");
    if (!cacheControl.includes("no-store")) probeFailures.push("protected-api-cache-control-missing-no-store");
    if (ageSeconds !== 0) probeFailures.push("protected-api-age-not-zero");
    if (["HIT", "STALE"].includes(vercelCache)) probeFailures.push("protected-api-cache-state-forbidden");
    if (!vercelCache) probeFailures.push("protected-api-cache-state-missing");

    failures.push(...probeFailures.map((failure) => `${path || "unknown"}:${failure}`));
    normalized.push({ path, method, observedAt: probeObservedAt, httpStatus, cacheControl, ageSeconds, vercelCache, passed: probeFailures.length === 0 });
  }

  for (const api of expected) {
    if (!seen.has(api.path)) failures.push(`${api.path}:missing-protected-api-probe`);
  }
  if (probes.length !== expected.length) failures.push("protected-api-probe-count-mismatch");
  const latestProbeAt = normalized.map((probe) => probe.observedAt).filter(Boolean).sort().at(-1) || null;
  if (observedAt && latestProbeAt && Date.parse(observedAt) < Date.parse(latestProbeAt)) failures.push("protected-api-evidence-observed-at-before-latest-probe");

  const uniqueFailures = [...new Set(failures)].sort();
  const passed = uniqueFailures.length === 0;
  const protectedApiProbeEvidence = Object.fromEntries(expected.map((api) => {
    const probe = normalized.find((item) => item.path === api.path);
    return [api.path, {
      status: passed && probe?.passed ? "passed" : "unverified",
      observedAt: passed && probe?.passed ? probe.observedAt : null,
      httpStatus: passed && probe?.passed ? probe.httpStatus : null,
      evidenceRef: passed && probe?.passed ? evidenceRef : null
    }];
  }));

  return {
    ok: passed,
    version: PROTECTED_API_PRODUCTION_EVIDENCE_VERSION,
    status: passed ? "passed" : "unverified",
    implementationFingerprint: currentFingerprint,
    evidenceImplementationFingerprint: evidenceFingerprint,
    apiCount: expected.length,
    passedApiCount: passed ? expected.length : 0,
    observedAt: passed ? observedAt : null,
    verifiedDeployment: passed ? {
      deploymentId: clean(deployment.deploymentId, 120),
      commitSha: clean(deployment.commitSha, 80).toLowerCase(),
      environment: "production",
      host: "scorecaster.vercel.app"
    } : null,
    probes: normalized,
    protectedApiProbeEvidence,
    failures: uniqueFailures,
    evidenceBoundary: {
      sessionCredentialSent: false,
      bearerTokenSent: false,
      rawResponseBodyIncluded: false,
      secretValuesIncluded: false,
      userDataIncluded: false,
      requestIdentifiersIncluded: false
    },
    paperOnly: true
  };
}
