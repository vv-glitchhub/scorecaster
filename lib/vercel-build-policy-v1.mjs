export const VERCEL_BUILD_POLICY_VERSION = "scorecaster-vercel-build-policy-v1";

export function normalizeVercelEnvironment(value) {
  const environment = String(value ?? "").trim().toLowerCase();
  return environment || "unknown";
}

export function shouldIgnoreVercelBuild(environment) {
  return normalizeVercelEnvironment(environment) === "preview";
}

export function vercelIgnoreCommandExitCode(environment) {
  return shouldIgnoreVercelBuild(environment) ? 0 : 1;
}

export function describeVercelBuildPolicy(environment) {
  const normalized = normalizeVercelEnvironment(environment);
  const ignore = shouldIgnoreVercelBuild(normalized);
  return {
    version: VERCEL_BUILD_POLICY_VERSION,
    environment: normalized,
    action: ignore ? "skip-preview-build" : "continue-build",
    ignored: ignore,
    productionAutoDeployPreserved: normalized === "production",
    unknownEnvironmentFailsTowardBuild: normalized === "unknown"
  };
}
