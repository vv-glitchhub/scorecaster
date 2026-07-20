export function autonomousAgentConfiguration() {
  const enabledFlag = process.env.SCORECASTER_AUTONOMOUS_AGENT_ENABLED === "true";
  const cronSecret = String(process.env.CRON_SECRET || "");
  const cronSecretConfigured = cronSecret.length >= 16;
  const adminConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const oddsProviderConfigured = Boolean(process.env.ODDS_API_KEY);

  return {
    codeAvailable: true,
    enabledFlag,
    cronSecretConfigured,
    adminConfigured,
    oddsProviderConfigured,
    schedulingManagedExternally: true,
    intervalMinutes: 60,
    agentActive: enabledFlag && cronSecretConfigured && adminConfigured && oddsProviderConfigured
  };
}

export function autonomousAgentAuthorizationValid(request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (secret.length < 16) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
