export function notificationDeliveryConfiguration() {
  const enabledFlag = process.env.SCORECASTER_NOTIFICATION_DELIVERY_ENABLED === "true";
  const adminConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const cronSecret = String(process.env.CRON_SECRET || "");
  const cronSecretConfigured = cronSecret.length >= 16;

  return {
    codeAvailable: true,
    enabledFlag,
    adminConfigured,
    cronSecretConfigured,
    expoAccessTokenConfigured: Boolean(process.env.EXPO_ACCESS_TOKEN),
    deliveryActive: enabledFlag && adminConfigured && cronSecretConfigured,
    schedulingManagedExternally: true
  };
}

export function notificationDeliveryAuthorizationValid(request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (secret.length < 16) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
