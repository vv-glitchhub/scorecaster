import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../lib/api-security";
import { notificationDeliveryConfiguration } from "../../../lib/notification-delivery-config";
import { watchlistMonitorConfiguration } from "../../../lib/watchlist-monitor-config";
import { settlementMonitorConfiguration } from "../../../lib/settlement-monitor-config.js";
import {
  classifyScheduledWorker,
  summarizeNotificationDeliveries
} from "../../../lib/operations-status";

export const dynamic = "force-dynamic";

function missingSchema(error) {
  return error?.code === "42P01" || error?.code === "42703" || /does not exist|schema cache|column .* does not exist/i.test(error?.message || "");
}

async function safeQuery(label, operation) {
  try {
    const result = await operation();
    if (result?.error) {
      if (missingSchema(result.error)) return { label, available: false, data: null, count: 0, warning: `${label} migration is not active` };
      return { label, available: true, data: null, count: 0, error: result.error };
    }
    return { label, available: true, data: result?.data ?? null, count: Number(result?.count || 0), warning: null };
  } catch (error) {
    return { label, available: true, data: null, count: 0, error };
  }
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "operations_overview",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const userId = auth.user.id;
  const since24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [
    watchlistState,
    settlementState,
    watchlistItems,
    openPaperBets,
    unreadAlerts,
    activeDevices,
    timeline24h,
    deliveries
  ] = await Promise.all([
    safeQuery("Watchlist Monitor", () => auth.supabase
      .from("watchlist_monitor_state")
      .select("next_check_at,lease_expires_at,last_started_at,last_completed_at,last_status,last_error,last_items_count,last_alerts_count,last_snapshots_count,updated_at")
      .eq("user_id", userId)
      .maybeSingle()),
    safeQuery("Settlement Monitor", () => auth.supabase
      .from("paper_settlement_monitor_state")
      .select("next_check_at,lease_expires_at,last_started_at,last_completed_at,last_status,last_error,last_open_count,last_settled_count,last_pending_count,last_provider_warnings_count,updated_at")
      .eq("user_id", userId)
      .maybeSingle()),
    safeQuery("Watchlist", () => auth.supabase
      .from("watchlist_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("active", true)),
    safeQuery("Paper Bets", () => auth.supabase
      .from("bets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "open")),
    safeQuery("Alert Inbox", () => auth.supabase
      .from("alert_inbox")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("active", true)
      .is("read_at", null)
      .is("dismissed_at", null)),
    safeQuery("Notification Devices", () => auth.supabase
      .from("notification_devices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("enabled", true)),
    safeQuery("Market Timeline", () => auth.supabase
      .from("market_timeline_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("captured_at", since24Hours)),
    safeQuery("Notification Delivery", () => auth.supabase
      .from("notification_deliveries")
      .select("status,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1000))
  ]);

  const fatal = [watchlistState, settlementState, watchlistItems, openPaperBets, unreadAlerts, activeDevices, timeline24h, deliveries]
    .find((result) => result.error);
  if (fatal) {
    return jsonResponse({ ok: false, error: publicError(fatal.error, "Operations overview could not be loaded") }, 500, requestId);
  }

  const watchlistConfiguration = watchlistMonitorConfiguration();
  const settlementConfiguration = settlementMonitorConfiguration();
  const deliveryConfiguration = notificationDeliveryConfiguration();
  const watchlistWorker = classifyScheduledWorker({
    available: watchlistState.available,
    active: watchlistConfiguration.monitorActive,
    state: watchlistState.data,
    intervalMinutes: watchlistConfiguration.intervalMinutes
  });
  const settlementWorker = classifyScheduledWorker({
    available: settlementState.available,
    active: settlementConfiguration.monitorActive,
    state: settlementState.data,
    intervalMinutes: 60
  });
  const deliveryWorker = summarizeNotificationDeliveries(deliveries.data || [], {
    available: deliveries.available,
    active: deliveryConfiguration.deliveryActive
  });

  const warnings = [watchlistState, settlementState, watchlistItems, openPaperBets, unreadAlerts, activeDevices, timeline24h, deliveries]
    .map((result) => result.warning)
    .filter(Boolean);

  const checklist = {
    watchlistMigration: watchlistState.available,
    settlementMigration: settlementState.available,
    notificationRegistryMigration: activeDevices.available,
    notificationDeliveryMigration: deliveries.available,
    watchlistWorkerConfigured: watchlistConfiguration.configured,
    watchlistWorkerEnabled: watchlistConfiguration.monitorActive,
    settlementWorkerConfigured: settlementConfiguration.adminConfigured && settlementConfiguration.scoresProviderConfigured && settlementConfiguration.cronSecretConfigured,
    settlementWorkerEnabled: settlementConfiguration.monitorActive,
    notificationDeliveryConfigured: deliveryConfiguration.adminConfigured && deliveryConfiguration.cronSecretConfigured,
    notificationDeliveryEnabled: deliveryConfiguration.deliveryActive,
    physicalPushDeviceRegistered: activeDevices.count > 0
  };

  return jsonResponse({
    ok: true,
    paperOnly: true,
    generatedAt: new Date().toISOString(),
    productBoundary: "sports analysis, alerting and virtual paper tracking only",
    workers: {
      watchlist: {
        ...watchlistWorker,
        active: watchlistConfiguration.monitorActive,
        intervalMinutes: watchlistConfiguration.intervalMinutes,
        state: watchlistState.data || null
      },
      settlement: {
        ...settlementWorker,
        active: settlementConfiguration.monitorActive,
        intervalMinutes: 60,
        state: settlementState.data || null
      },
      notificationDelivery: {
        ...deliveryWorker,
        active: deliveryConfiguration.deliveryActive
      }
    },
    accountActivity: {
      activeWatchlistItems: watchlistItems.count,
      openPaperBets: openPaperBets.count,
      unreadActiveAlerts: unreadAlerts.count,
      activeNotificationDevices: activeDevices.count,
      marketTimelineSnapshots24h: timeline24h.count
    },
    configurations: {
      watchlist: {
        codeAvailable: watchlistConfiguration.codeAvailable,
        enabledFlag: watchlistConfiguration.enabledByFlag,
        serviceRoleConfigured: watchlistConfiguration.serviceRoleConfigured,
        cronSecretConfigured: watchlistConfiguration.cronSecretConfigured,
        schedulingManagedExternally: watchlistConfiguration.schedulingManagedExternally
      },
      settlement: {
        codeAvailable: settlementConfiguration.codeAvailable,
        enabledFlag: settlementConfiguration.enabledFlag,
        adminConfigured: settlementConfiguration.adminConfigured,
        scoresProviderConfigured: settlementConfiguration.scoresProviderConfigured,
        cronSecretConfigured: settlementConfiguration.cronSecretConfigured,
        schedulingManagedExternally: settlementConfiguration.schedulingManagedExternally
      },
      notificationDelivery: {
        codeAvailable: deliveryConfiguration.codeAvailable,
        enabledFlag: deliveryConfiguration.enabledFlag,
        adminConfigured: deliveryConfiguration.adminConfigured,
        cronSecretConfigured: deliveryConfiguration.cronSecretConfigured,
        expoAccessTokenConfigured: deliveryConfiguration.expoAccessTokenConfigured,
        schedulingManagedExternally: deliveryConfiguration.schedulingManagedExternally
      }
    },
    checklist,
    warnings
  }, 200, requestId);
}
