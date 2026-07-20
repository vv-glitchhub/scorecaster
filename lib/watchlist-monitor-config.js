export function watchlistMonitorConfiguration() {
  const enabledByFlag = process.env.SCORECASTER_WATCHLIST_MONITOR_ENABLED === "true";
  const cronSecret = String(process.env.CRON_SECRET || "");
  const cronSecretConfigured = cronSecret.length >= 16;
  const serviceRoleConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const configured = cronSecretConfigured && serviceRoleConfigured;

  return {
    codeAvailable: true,
    enabledByFlag,
    configured,
    monitorActive: enabledByFlag && configured,
    cronSecretConfigured,
    serviceRoleConfigured,
    schedulingManagedExternally: true,
    intervalMinutes: 15,
    maxUsersPerRun: 20,
    maxItemsPerUser: 50,
    maxSportsPerRun: 12
  };
}

export function watchlistMonitorAuthorizationValid(request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (secret.length < 16) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}