export const LIVE_DATA_CACHE_PRODUCTION_EVIDENCE_VERSION = "scorecaster-live-data-cache-production-evidence-v1";

const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

const validFingerprint = (value) => /^[0-9a-f]{64}$/i.test(clean(value, 80));
const validCommit = (value) => /^[0-9a-f]{7,64}$/i.test(clean(value, 80));
const safeHost = (value) => {
  const text = clean(value, 240).replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
  return /^[a-z0-9.-]+(?::\d+)?$/i.test(text) ? text : null;
};
const safeIso = (value) => {
  const text = clean(value, 64);
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

function assessProbe(probe = {}, policy = {}) {
  const failures = [];
  const path = clean(probe.path, 180);
  const observedAt = safeIso(probe.observedAt);
  const httpStatus = Number.isInteger(Number(probe.httpStatus)) ? Number(probe.httpStatus) : null;
  const cacheControl = clean(probe.cacheControl, 240).toLowerCase();
  const ageSeconds = Number.isFinite(Number(probe.ageSeconds)) ? Number(probe.ageSeconds) : null;
  const vercelCache = clean(probe.vercelCache, 32).toUpperCase();
  const allowedPaths = Array.isArray(policy?.productionProbe?.paths) ? policy.productionProbe.paths : [];
  const requiredTokens = Array.isArray(policy?.productionProbe?.requiredCacheControlTokens)
    ? policy.productionProbe.requiredCacheControlTokens.map((item) => clean(item, 80).toLowerCase()).filter(Boolean)
    : [];
  const forbiddenStates = Array.isArray(policy?.productionProbe?.forbiddenVercelCacheStates)
    ? policy.productionProbe.forbiddenVercelCacheStates.map((item) => clean(item, 32).toUpperCase()).filter(Boolean)
    : [];
  const maximumAge = Number(policy?.productionProbe?.maximumAgeHeaderSeconds);

  if (!allowedPaths.includes(path)) failures.push("probe-path-not-allowed");
  if (!observedAt) failures.push("probe-observed-at-invalid");
  if (httpStatus !== 200) failures.push("probe-http-status-not-200");
  for (const token of requiredTokens) {
    if (!cacheControl.includes(token)) failures.push(`probe-cache-control-missing:${token}`);
  }
  if (!Number.isFinite(ageSeconds)) failures.push("probe-age-missing");
  else if (Number.isFinite(maximumAge) && ageSeconds > maximumAge) failures.push("probe-age-above-maximum");
  if (!vercelCache) failures.push("probe-vercel-cache-missing");
  else if (forbiddenStates.includes(vercelCache)) failures.push(`probe-vercel-cache-forbidden:${vercelCache}`);

  return {
    passed: failures.length === 0,
    path,
    observedAt,
    httpStatus,
    cacheControl,
    ageSeconds,
    vercelCache,
    failures
  };
}

export function buildTrustedLiveDataCacheGateEvidence({
  trustedDocument = {},
  implementation = {},
  policy = {}
} = {}) {
  const gateId = clean(policy?.releaseGate?.id, 120);
  const raw = trustedDocument?.gates?.[gateId];
  const failures = [];

  if (trustedDocument?.schemaVersion !== 1) failures.push("invalid-trusted-evidence-schema-version");
  if (trustedDocument?.product !== "Scorecaster") failures.push("invalid-trusted-evidence-product");
  if (!gateId || gateId !== "live-data-pwa-cache-boundary") failures.push("invalid-cache-gate-id");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) failures.push("trusted-cache-gate-evidence-missing");

  const implementationFingerprint = validFingerprint(implementation?.implementationFingerprint)
    ? clean(implementation.implementationFingerprint, 80).toLowerCase()
    : null;
  const evidenceFingerprint = validFingerprint(raw?.implementationFingerprint)
    ? clean(raw.implementationFingerprint, 80).toLowerCase()
    : null;
  if (!implementationFingerprint) failures.push("current-implementation-fingerprint-invalid");
  if (!evidenceFingerprint) failures.push("evidence-implementation-fingerprint-invalid");
  if (implementationFingerprint && evidenceFingerprint && implementationFingerprint !== evidenceFingerprint) {
    failures.push("production-evidence-stale-for-current-cache-implementation");
  }

  if (raw?.status !== "passed") failures.push("trusted-cache-gate-status-not-passed");
  if (raw?.evidenceType !== "vercel-production-double-probe-v1") failures.push("unsupported-cache-evidence-type");
  if (raw?.verifiedDeployment?.environment !== "production") failures.push("evidence-not-production");
  if (!clean(raw?.verifiedDeployment?.deploymentId, 120).startsWith("dpl_")) failures.push("deployment-id-invalid");
  if (!validCommit(raw?.verifiedDeployment?.commitSha)) failures.push("verified-commit-invalid");
  const host = safeHost(raw?.verifiedDeployment?.host);
  if (!host || host !== "scorecaster.vercel.app") failures.push("verified-production-host-invalid");
  const observedAt = safeIso(raw?.observedAt);
  if (!observedAt) failures.push("evidence-observed-at-invalid");
  if (!clean(raw?.evidenceRef, 240)) failures.push("evidence-reference-missing");

  if (raw?.rawResponseBodyIncluded !== false) failures.push("raw-response-body-must-not-be-retained");
  if (raw?.secretValuesIncluded !== false) failures.push("secret-values-must-not-be-retained");
  if (raw?.userIdentifiersIncluded !== false) failures.push("user-identifiers-must-not-be-retained");
  if (raw?.providerPayloadsIncluded !== false) failures.push("provider-payloads-must-not-be-retained");

  const probes = Array.isArray(raw?.probes) ? raw.probes.map((probe) => assessProbe(probe, policy)) : [];
  if (probes.length < 2) failures.push("at-least-two-production-probes-required");
  if (probes.some((probe) => !probe.passed)) failures.push("production-cache-probe-failed");
  const distinctObservedAt = new Set(probes.map((probe) => probe.observedAt).filter(Boolean));
  if (probes.length >= 2 && distinctObservedAt.size < 2) failures.push("production-probes-must-be-distinct");

  const uniqueFailures = [...new Set([
    ...failures,
    ...probes.flatMap((probe) => probe.failures)
  ])].sort();
  const passed = uniqueFailures.length === 0;
  const manualGateEvidence = gateId ? {
    [gateId]: {
      status: passed ? "passed" : "unverified",
      observedAt: passed ? observedAt : null,
      evidenceRef: passed ? clean(raw?.evidenceRef, 240) : null
    }
  } : {};

  return {
    ok: passed,
    version: LIVE_DATA_CACHE_PRODUCTION_EVIDENCE_VERSION,
    gateId: gateId || null,
    status: passed ? "passed" : "unverified",
    implementationFingerprint,
    evidenceImplementationFingerprint: evidenceFingerprint,
    verifiedDeployment: passed ? {
      deploymentId: clean(raw?.verifiedDeployment?.deploymentId, 120),
      commitSha: clean(raw?.verifiedDeployment?.commitSha, 80).toLowerCase(),
      environment: "production",
      host
    } : null,
    observedAt: passed ? observedAt : null,
    probeCount: probes.length,
    probes: probes.map((probe) => ({
      path: probe.path,
      observedAt: probe.observedAt,
      httpStatus: probe.httpStatus,
      cacheControl: probe.cacheControl,
      ageSeconds: probe.ageSeconds,
      vercelCache: probe.vercelCache,
      passed: probe.passed
    })),
    manualGateEvidence,
    failures: uniqueFailures,
    evidenceBoundary: {
      rawResponseBodyIncluded: false,
      secretValuesIncluded: false,
      userIdentifiersIncluded: false,
      providerPayloadsIncluded: false
    },
    paperOnly: true
  };
}
