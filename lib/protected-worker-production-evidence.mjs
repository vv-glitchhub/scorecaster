export const PROTECTED_WORKER_PRODUCTION_EVIDENCE_VERSION = "scorecaster-protected-worker-production-evidence-v1";

const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

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
  if (/password|passwd|secret|token=|apikey|api_key|authorization|bearer\s|service[_-]?role|private[_ -]?key/i.test(text)) return null;
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

function expectedWorkers(manifest = {}) {
  return (Array.isArray(manifest.internalWorkers) ? manifest.internalWorkers : [])
    .map((worker) => ({
      path: clean(worker?.path, 180),
      method: clean(worker?.method, 12).toUpperCase(),
      allowedStatuses: Array.isArray(worker?.allowedStatuses)
        ? worker.allowedStatuses.filter((value) => Number.isInteger(Number(value))).map(Number)
        : []
    }))
    .filter((worker) => worker.path.startsWith("/api/internal/") && worker.method);
}

export function buildTrustedProtectedWorkerProbeEvidence({
  trustedDocument = {},
  implementation = {},
  manifest = {}
} = {}) {
  const failures = [];
  const expected = expectedWorkers(manifest);
  const expectedByPath = new Map(expected.map((worker) => [worker.path, worker]));
  const currentFingerprint = validFingerprint(implementation?.implementationFingerprint)
    ? clean(implementation.implementationFingerprint, 80).toLowerCase()
    : null;
  const evidenceFingerprint = validFingerprint(trustedDocument?.implementationFingerprint)
    ? clean(trustedDocument.implementationFingerprint, 80).toLowerCase()
    : null;

  if (trustedDocument?.schemaVersion !== 1) failures.push("invalid-worker-evidence-schema-version");
  if (trustedDocument?.product !== "Scorecaster") failures.push("invalid-worker-evidence-product");
  if (trustedDocument?.evidenceType !== "vercel-production-unauthenticated-worker-probes-v1") failures.push("unsupported-worker-evidence-type");
  if (implementation?.schemaVersion !== 1) failures.push("invalid-worker-implementation-schema-version");
  if (implementation?.contractVersion !== "scorecaster-protected-worker-contract-v2") failures.push("unsupported-worker-contract-version");
  if (!currentFingerprint) failures.push("current-worker-implementation-fingerprint-invalid");
  if (!evidenceFingerprint) failures.push("worker-evidence-implementation-fingerprint-invalid");
  if (currentFingerprint && evidenceFingerprint && currentFingerprint !== evidenceFingerprint) failures.push("worker-production-evidence-stale");
  if (Number(implementation?.workerCount) !== expected.length) failures.push("worker-implementation-count-mismatch");

  const deployment = trustedDocument?.verifiedDeployment || {};
  if (deployment.environment !== "production") failures.push("worker-evidence-not-production");
  if (!clean(deployment.deploymentId, 120).startsWith("dpl_")) failures.push("worker-deployment-id-invalid");
  if (!validCommit(deployment.commitSha)) failures.push("worker-verified-commit-invalid");
  if (clean(deployment.host, 240).toLowerCase() !== "scorecaster.vercel.app") failures.push("worker-production-host-invalid");
  const observedAt = safeIso(trustedDocument?.observedAt);
  if (!observedAt) failures.push("worker-evidence-observed-at-invalid");
  const evidenceRef = safeEvidenceRef(trustedDocument?.evidenceRef);
  if (!evidenceRef) failures.push("worker-evidence-reference-invalid-or-secret-bearing");

  if (trustedDocument?.cronSecretSent !== false) failures.push("cron-secret-must-not-be-sent");
  if (trustedDocument?.authorizationCredentialSent !== false) failures.push("authorization-credential-must-not-be-sent");
  if (trustedDocument?.rawResponseBodyIncluded !== false) failures.push("worker-raw-response-body-must-not-be-retained");
  if (trustedDocument?.secretValuesIncluded !== false) failures.push("worker-secret-values-must-not-be-retained");
  if (trustedDocument?.userIdentifiersIncluded !== false) failures.push("worker-user-identifiers-must-not-be-retained");
  if (trustedDocument?.providerPayloadsIncluded !== false) failures.push("worker-provider-payloads-must-not-be-retained");

  const probes = Array.isArray(trustedDocument?.probes) ? trustedDocument.probes : [];
  const seen = new Set();
  const normalized = [];
  for (const probe of probes) {
    const path = clean(probe?.path, 180);
    const method = clean(probe?.method, 12).toUpperCase();
    const probeObservedAt = safeIso(probe?.observedAt);
    const httpStatus = Number.isInteger(Number(probe?.httpStatus)) ? Number(probe.httpStatus) : null;
    const cacheControl = clean(probe?.cacheControl, 160).toLowerCase();
    const ageSeconds = Number.isFinite(Number(probe?.ageSeconds)) ? Number(probe.ageSeconds) : null;
    const vercelCache = clean(probe?.vercelCache, 32).toUpperCase();
    const expectedWorker = expectedByPath.get(path);
    const probeFailures = [];

    if (!expectedWorker) probeFailures.push("unexpected-worker-path");
    if (seen.has(path)) probeFailures.push("duplicate-worker-probe");
    seen.add(path);
    if (expectedWorker && method !== expectedWorker.method) probeFailures.push("worker-method-mismatch");
    if (!probeObservedAt) probeFailures.push("worker-probe-observed-at-invalid");
    if (expectedWorker && !expectedWorker.allowedStatuses.includes(httpStatus)) probeFailures.push("worker-http-status-not-allowed");
    if (!cacheControl.includes("no-store")) probeFailures.push("worker-probe-cache-control-missing-no-store");
    if (ageSeconds !== 0) probeFailures.push("worker-probe-age-not-zero");
    if (["HIT", "STALE"].includes(vercelCache)) probeFailures.push("worker-probe-cache-state-forbidden");
    if (!vercelCache) probeFailures.push("worker-probe-cache-state-missing");

    failures.push(...probeFailures.map((failure) => `${path || "unknown"}:${failure}`));
    normalized.push({ path, method, observedAt: probeObservedAt, httpStatus, cacheControl, ageSeconds, vercelCache, passed: probeFailures.length === 0 });
  }

  for (const worker of expected) {
    if (!seen.has(worker.path)) failures.push(`${worker.path}:missing-worker-probe`);
  }
  if (probes.length !== expected.length) failures.push("worker-probe-count-mismatch");
  const latestProbeAt = normalized.map((probe) => probe.observedAt).filter(Boolean).sort().at(-1) || null;
  if (observedAt && latestProbeAt && Date.parse(observedAt) < Date.parse(latestProbeAt)) failures.push("worker-evidence-observed-at-before-latest-probe");

  const uniqueFailures = [...new Set(failures)].sort();
  const passed = uniqueFailures.length === 0;
  const workerProbeEvidence = Object.fromEntries(expected.map((worker) => {
    const probe = normalized.find((item) => item.path === worker.path);
    return [worker.path, {
      status: passed && probe?.passed ? "passed" : "unverified",
      observedAt: passed && probe?.passed ? probe.observedAt : null,
      httpStatus: passed && probe?.passed ? probe.httpStatus : null,
      evidenceRef: passed && probe?.passed ? evidenceRef : null
    }];
  }));

  return {
    ok: passed,
    version: PROTECTED_WORKER_PRODUCTION_EVIDENCE_VERSION,
    status: passed ? "passed" : "unverified",
    implementationFingerprint: currentFingerprint,
    evidenceImplementationFingerprint: evidenceFingerprint,
    workerCount: expected.length,
    passedWorkerCount: passed ? expected.length : normalized.filter((probe) => probe.passed).length,
    observedAt: passed ? observedAt : null,
    verifiedDeployment: passed ? {
      deploymentId: clean(deployment.deploymentId, 120),
      commitSha: clean(deployment.commitSha, 80).toLowerCase(),
      environment: "production",
      host: "scorecaster.vercel.app"
    } : null,
    probes: normalized,
    workerProbeEvidence,
    failures: uniqueFailures,
    evidenceBoundary: {
      cronSecretSent: false,
      authorizationCredentialSent: false,
      rawResponseBodyIncluded: false,
      secretValuesIncluded: false,
      userIdentifiersIncluded: false,
      providerPayloadsIncluded: false
    },
    paperOnly: true
  };
}
