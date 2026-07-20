export function settlementMonitorConfiguration() {
  const cronSecret = String(process.env.CRON_SECRET || "");
  const enabledFlag = process.env.SCORECASTER_SETTLEMENT_MONITOR_ENABLED === "true";
  const adminConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const scoresProviderConfigured = Boolean(process.env.ODDS_API_KEY);
  const cronSecretConfigured = cronSecret.length >= 16;

  return {
    codeAvailable: true,
    enabledFlag,
    adminConfigured,
    scoresProviderConfigured,
    cronSecretConfigured,
    schedulingManagedExternally: true,
    monitorActive: enabledFlag && adminConfigured && scoresProviderConfigured && cronSecretConfigured
  };
}

export function settlementMonitorAuthorizationValid(request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (secret.length < 16) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
