const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export const SHADOW_LEARNING_REPOSITORY_DEFAULT = true;

function resolveEnabledFlag(env = process.env) {
  const raw = String(env?.SCORECASTER_SHADOW_LEARNING_ENABLED ?? "").trim().toLowerCase();
  if (TRUE_VALUES.has(raw)) return { enabled: true, mode: "explicit-enabled" };
  if (FALSE_VALUES.has(raw)) return { enabled: false, mode: "explicit-disabled" };
  if (raw) return { enabled: false, mode: "invalid-value-disabled" };
  const production = String(env?.NODE_ENV || "").toLowerCase() === "production";
  return {
    enabled: production && SHADOW_LEARNING_REPOSITORY_DEFAULT,
    mode: production && SHADOW_LEARNING_REPOSITORY_DEFAULT
      ? "repository-production-enabled"
      : "nonproduction-default-disabled"
  };
}

export function shadowLearningConfiguration(env = process.env) {
  const activation = resolveEnabledFlag(env);
  const cronSecret = String(env?.CRON_SECRET || "");
  const cronSecretConfigured = cronSecret.length >= 16;
  const adminConfigured = Boolean(
    env?.NEXT_PUBLIC_SUPABASE_URL && env?.SUPABASE_SERVICE_ROLE_KEY
  );

  return {
    codeAvailable: true,
    enabledFlag: activation.enabled,
    activationMode: activation.mode,
    repositoryDefaultEnabled: SHADOW_LEARNING_REPOSITORY_DEFAULT,
    emergencyStopAvailable: true,
    cronSecretConfigured,
    adminConfigured,
    schedulingManagedExternally: true,
    minimumSettledSamples: 300,
    minimumClvSamples: 100,
    learningMode: "shadow-only",
    automaticPromotionAllowed: false,
    realMoneyBetting: false,
    workerActive: activation.enabled && cronSecretConfigured && adminConfigured
  };
}

export function shadowLearningAuthorizationValid(request, env = process.env) {
  const secret = String(env?.CRON_SECRET || "");
  if (secret.length < 16) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
