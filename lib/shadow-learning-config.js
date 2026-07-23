export function shadowLearningConfiguration() {
  const enabledFlag = process.env.SCORECASTER_SHADOW_LEARNING_ENABLED === "true";
  const cronSecret = String(process.env.CRON_SECRET || "");
  const cronSecretConfigured = cronSecret.length >= 16;
  const adminConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return {
    codeAvailable: true,
    enabledFlag,
    cronSecretConfigured,
    adminConfigured,
    schedulingManagedExternally: true,
    minimumSettledSamples: 300,
    minimumClvSamples: 100,
    learningMode: "shadow-only",
    automaticPromotionAllowed: false,
    realMoneyBetting: false,
    workerActive: enabledFlag && cronSecretConfigured && adminConfigured
  };
}

export function shadowLearningAuthorizationValid(request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (secret.length < 16) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
