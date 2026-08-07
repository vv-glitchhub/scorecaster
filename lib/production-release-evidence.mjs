import { createHash } from "node:crypto";

export const PRODUCTION_RELEASE_EVIDENCE_VERSION = "scorecaster-production-release-evidence-v1";

const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

const safeEnvironment = (value) => {
  const normalized = clean(value, 24).toLowerCase();
  return ["production", "preview", "development"].includes(normalized) ? normalized : "unknown";
};

const safeStatus = (value) => {
  const normalized = clean(value, 32).toLowerCase();
  return ["passed", "failed", "unverified", "not-applicable"].includes(normalized) ? normalized : "unverified";
};

const canonical = (value) => JSON.stringify(value, Object.keys(value || {}).sort());
const fingerprint = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function safeHost(value) {
  const text = clean(value, 240).replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!text || !/^[a-z0-9.-]+(?::\d+)?$/i.test(text)) return null;
  return text.toLowerCase();
}

function safeCommit(value) {
  const text = clean(value, 80).toLowerCase();
  return /^[0-9a-f]{7,64}$/.test(text) ? text : null;
}

function gateEvidenceMap(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const id = clean(key, 120);
    const status = safeStatus(entry?.status ?? entry);
    return [id, {
      status,
      observedAt: clean(entry?.observedAt, 64) || null,
      evidenceRef: clean(entry?.evidenceRef, 240) || null
    }];
  }).filter(([id]) => Boolean(id)));
}

function probeEvidenceMap(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const path = clean(key, 180);
    return [path, {
      status: safeStatus(entry?.status ?? entry),
      observedAt: clean(entry?.observedAt, 64) || null,
      httpStatus: Number.isInteger(Number(entry?.httpStatus)) ? Number(entry.httpStatus) : null,
      evidenceRef: clean(entry?.evidenceRef, 240) || null
    }];
  }).filter(([path]) => path.startsWith("/api/")));
}

export function runtimeDeploymentEvidence(env = process.env) {
  const commitSha = safeCommit(env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA);
  const environment = safeEnvironment(env.VERCEL_ENV || env.NODE_ENV);
  const host = safeHost(env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL);
  return {
    source: commitSha || host ? "runtime-metadata" : "unverified",
    environment,
    commitSha,
    host,
    deploymentObserved: Boolean(commitSha && host),
    productionRuntimeObserved: Boolean(commitSha && host && environment === "production")
  };
}

export function buildProductionReleaseEvidence({
  productionEvidence = {},
  manifest = {},
  deployment = {},
  migrationEvidence = {},
  manualGateEvidence = {},
  workerProbeEvidence = {}
} = {}) {
  const migrations = Array.isArray(manifest.supabaseMigrations) ? manifest.supabaseMigrations.map((item) => clean(item, 180)).filter(Boolean) : [];
  const productionPatches = Array.isArray(manifest.productionPatches) ? manifest.productionPatches.map((item) => clean(item, 180)).filter(Boolean) : [];
  const manualChecks = Array.isArray(manifest.manualReleaseChecks) ? manifest.manualReleaseChecks : [];
  const internalWorkers = Array.isArray(manifest.internalWorkers) ? manifest.internalWorkers : [];
  const gateEvidence = gateEvidenceMap(manualGateEvidence);
  const probeEvidence = probeEvidenceMap(workerProbeEvidence);

  const manualGates = manualChecks.map((item) => {
    const id = clean(item?.id, 120);
    const evidence = gateEvidence[id] || { status: "unverified", observedAt: null, evidenceRef: null };
    return {
      id,
      title: clean(item?.title, 320),
      blocking: item?.blocking !== false,
      status: evidence.status,
      observedAt: evidence.observedAt,
      evidenceRef: evidence.evidenceRef
    };
  }).filter((item) => item.id);

  const protectedWorkerProbes = internalWorkers.map((item) => {
    const path = clean(item?.path, 180);
    const evidence = probeEvidence[path] || { status: "unverified", observedAt: null, httpStatus: null, evidenceRef: null };
    return {
      path,
      method: clean(item?.method, 12).toUpperCase(),
      expectedUnauthenticatedStatuses: Array.isArray(item?.allowedStatuses)
        ? item.allowedStatuses.filter((status) => Number.isInteger(Number(status))).map(Number)
        : [],
      status: evidence.status,
      observedAt: evidence.observedAt,
      httpStatus: evidence.httpStatus,
      evidenceRef: evidence.evidenceRef
    };
  }).filter((item) => item.path.startsWith("/api/"));

  const migrationStatus = safeStatus(migrationEvidence.status);
  const deploymentEvidence = {
    source: clean(deployment.source, 60) || "unverified",
    environment: safeEnvironment(deployment.environment),
    commitSha: safeCommit(deployment.commitSha),
    host: safeHost(deployment.host),
    deploymentObserved: Boolean(deployment.deploymentObserved),
    productionRuntimeObserved: Boolean(deployment.productionRuntimeObserved)
  };

  const migrationInventory = {
    status: migrationStatus,
    observedAt: clean(migrationEvidence.observedAt, 64) || null,
    evidenceRef: clean(migrationEvidence.evidenceRef, 240) || null,
    migrationCount: migrations.length,
    latestMigration: migrations.at(-1) || null,
    productionPatchCount: productionPatches.length,
    migrationsFingerprint: fingerprint(migrations),
    productionPatchesFingerprint: fingerprint(productionPatches)
  };

  const productionState = clean(productionEvidence.releaseState, 32).toLowerCase() || "blocked";
  const runtimeWorker = productionEvidence.worker && typeof productionEvidence.worker === "object"
    ? {
        state: clean(productionEvidence.worker.state, 24) || "unknown",
        observedCycles: Number(productionEvidence.worker.observedCycles ?? 0),
        completedCycles: Number(productionEvidence.worker.cycles ?? 0),
        denominator: Number(productionEvidence.worker.denominator ?? 0),
        successRate: Number.isFinite(Number(productionEvidence.worker.successRate)) ? Number(productionEvidence.worker.successRate) : null,
        latestAt: clean(productionEvidence.worker.latestAt, 64) || null,
        latestAgeMinutes: Number.isFinite(Number(productionEvidence.worker.latestAgeMinutes)) ? Number(productionEvidence.worker.latestAgeMinutes) : null
      }
    : {
        state: "missing",
        observedCycles: 0,
        completedCycles: 0,
        denominator: 0,
        successRate: null,
        latestAt: null,
        latestAgeMinutes: null
      };

  const unresolvedManualGates = manualGates.filter((gate) => gate.blocking && gate.status !== "passed");
  const unresolvedWorkerProbes = protectedWorkerProbes.filter((probe) => probe.status !== "passed");
  const blockers = [];
  if (productionState !== "ready") blockers.push(`production-evidence-${productionState}`);
  if (!deploymentEvidence.productionRuntimeObserved) blockers.push("production-deployment-unverified");
  if (migrationInventory.status !== "passed") blockers.push("production-migrations-unverified");
  if (runtimeWorker.state !== "enabled") blockers.push("runtime-worker-evidence-below-target");
  if (unresolvedWorkerProbes.length) blockers.push("protected-worker-probes-unverified");
  if (unresolvedManualGates.length) blockers.push("manual-release-gates-unverified");

  const manifestIdentity = {
    product: clean(manifest.product, 80) || "Scorecaster",
    productionBaseUrl: clean(manifest.productionBaseUrl, 240) || null,
    migrations,
    productionPatches,
    manualGateIds: manualGates.map((gate) => gate.id),
    internalWorkerPaths: protectedWorkerProbes.map((probe) => `${probe.method}:${probe.path}`)
  };

  const generatedAt = clean(productionEvidence.generatedAt, 64) || new Date().toISOString();
  const artifactCore = {
    version: PRODUCTION_RELEASE_EVIDENCE_VERSION,
    generatedAt,
    productionEvidenceVersion: clean(productionEvidence.version, 120) || null,
    productionEvidenceGeneratedAt: clean(productionEvidence.generatedAt, 64) || null,
    productionEvidenceReleaseState: productionState,
    deployment: deploymentEvidence,
    migrationInventory,
    runtimeWorker,
    protectedWorkerProbes,
    manualGates,
    manifestFingerprint: fingerprint(manifestIdentity),
    blockers: [...new Set(blockers)]
  };

  return {
    ok: true,
    ...artifactCore,
    artifactId: fingerprint(artifactCore),
    activationEligible: artifactCore.blockers.length === 0,
    evidenceSummary: {
      productionEvidenceReady: productionState === "ready",
      deploymentVerified: deploymentEvidence.productionRuntimeObserved,
      migrationsVerified: migrationInventory.status === "passed",
      runtimeWorkerEnabled: runtimeWorker.state === "enabled",
      protectedWorkerProbesPassed: protectedWorkerProbes.length > 0 && unresolvedWorkerProbes.length === 0,
      manualBlockingGatesPassed: manualGates.filter((gate) => gate.blocking).length > 0 && unresolvedManualGates.length === 0
    },
    provenance: {
      productionEvidence: "Scorecaster Production Evidence V1 report",
      deployment: "safe runtime metadata only; no token, credential or request header fields",
      migrationInventory: "config/release-readiness.json plus separately supplied production verification status",
      workerProbes: "release manifest declarations plus separately supplied production probe evidence",
      manualGates: "release manifest declarations plus separately supplied reviewed evidence references"
    },
    safety: {
      paperOnly: true,
      realMoneyExecution: false,
      bookmakerCredentialsIncluded: false,
      rawProviderPayloadsIncluded: false,
      userIdentifiersIncluded: false,
      secretEnvironmentValuesIncluded: false,
      missingEvidenceImputed: false
    }
  };
}
