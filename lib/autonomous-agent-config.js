export function autonomousAgentConfiguration() {
  const explicitlyDisabled =
    process.env.SCORECASTER_AUTONOMOUS_AGENT_DISABLED === "true" ||
    process.env.SCORECASTER_AUTONOMOUS_AGENT_ENABLED === "false";
  const enabledFlag = !explicitlyDisabled;
  const cronSecret = String(process.env.CRON_SECRET || "");
  const cronSecretConfigured = cronSecret.length >= 16;
  const adminConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const oddsProviderConfigured = Boolean(process.env.ODDS_API_KEY);
  const unifiedDataConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.ODDS_API_KEY
  );

  return {
    version: "autonomous-paper-agent-v2",
    codeAvailable: true,
    enabledFlag,
    explicitlyDisabled,
    cronSecretConfigured,
    adminConfigured,
    oddsProviderConfigured,
    unifiedDataConfigured,
    schedulingManagedExternally: true,
    intervalMinutes: 15,
    adaptiveCadence: true,
    shadowLearningOnly: true,
    productionProbabilityChangedByLearning: false,
    realMoneyBetting: false,
    agentActive: enabledFlag && cronSecretConfigured && adminConfigured && oddsProviderConfigured
  };
}

export function autonomousAgentAuthorizationValid(request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (secret.length < 16) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
