export const SECONDARY_PROVIDER_ACQUISITION_POLICY_VERSION = "scorecaster-secondary-provider-acquisition-v1";

export function isAuthorizedUnifiedDataCapture({ authorization = "", cronSecret = "" } = {}) {
  const secret = String(cronSecret || "").trim();
  if (!secret) return false;
  return String(authorization || "") === `Bearer ${secret}`;
}

export function secondaryProviderAcquisitionMode({ authorizedCapture = false } = {}) {
  return authorizedCapture ? "live-worker-capture" : "worker-only";
}

export function workerOnlySecondaryProviderState({ retrievedAt = null } = {}) {
  return {
    ok: true,
    source: "sportsgameodds",
    mode: "worker_only",
    retrievedAt: retrievedAt || new Date().toISOString(),
    data: null,
    acquisition: "worker-only",
    networkRequestMade: false
  };
}
