import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../lib/api-security";
import { autonomousAgentConfiguration } from "../../../lib/autonomous-agent-config.js";
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
    autonomousState,
    autonomousSettings,
    autonomousRuns24h,
    autonomousAudit24h,
    autonomousBrief,
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
    safeQuery("Autonomous Agent V2", () => auth.supabase
      .from("autonomous_agent_state")
      .select("next_check_at,lease_expires_at,last_started_at,last_completed_at,last_status,last_error,last_run_id,last_candidate_count,last_selected_count,last_saved_count,last_skipped_count,last_total_stake,paused_until,pause_reason,health_status,health_score,resolved_sample,consecutive_losses,drawdown_percent,roi,average_clv,last_brief,updated_at")
      .eq("user_id", userId)
      .maybeSingle()),
    safeQuery("Autonomous Agent V2 Settings", () => auth.supabase
      .from("autonomous_agent_settings")
      .select("enabled,daily_pick_limit,min_priority_score,min_odds,max_odds,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled,updated_at")
      .eq("user_id", userId)
      .maybeSingle()),
    safeQuery("Autonomous Agent Runs", () => auth.supabase
      .from("autonomous_agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since24Hours)),
    safeQuery("Autonomous Agent Decision Audit", () => auth.supabase
      .from("autonomous_agent_decision_audit")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since24Hours)),
    safeQuery("Autonomous Agent Daily Brief", () => auth.supabase
      .from("autonomous_agent_daily_briefs")
      .select("brief_date,brief,updated_at")
      .eq("user_id", userId)
      .order("brief_date", { ascending: false })
      .limit(1)
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

  const results = [watchlistState, settlementState, autonomousState, autonomousSettings, autonomousRuns24h, autonomousAudit24h, autonomousBrief, watchlistItems, openPaperBets, unreadAlerts, activeDevices, timeline24h, deliveries];
  const fatal = results.find((result) => result.error);
  if (fatal) {
    return jsonResponse({ ok: false, error: publicError(fatal.error, "Operations overview could not be loaded") }, 500, requestId);
  }

  const watchlistConfiguration = watchlistMonitorConfiguration();
  const settlementConfiguration = settlementMonitorConfiguration();
  const autonomousConfiguration = autonomousAgentConfiguration();
  const deliveryConfiguration = notificationDeliveryConfiguration();
  const autonomousUserEnabled = autonomousSettings.data?.enabled === true;
  const autonomousPaused = Boolean(autonomousState.data?.paused_until && Date.parse(autonomousState.data.paused_until) > Date.now());
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
  const autonomousWorker = classifyScheduledWorker({
    available: autonomousState.available && autonomousSettings.available && autonomousAudit24h.available,
    active: autonomousConfiguration.agentActive && autonomousUserEnabled && !autonomousPaused,
    state: autonomousState.data,
    intervalMinutes: autonomousConfiguration.intervalMinutes
  });
  const deliveryWorker = summarizeNotificationDeliveries(deliveries.data || [], {
    available: deliveries.available,
    active: deliveryConfiguration.deliveryActive
  });

  const warnings = results.map((result) => result.warning).filter(Boolean);
  const checklist = {
    watchlistMigration: watchlistState.available,
    settlementMigration: settlementState.available,
    autonomousAgentMigration: autonomousState.available && autonomousSettings.available,
    autonomousAgentV2Migration: autonomousAudit24h.available && autonomousBrief.available,
    notificationRegistryMigration: activeDevices.available,
    notificationDeliveryMigration: deliveries.available,
    watchlistWorkerConfigured: watchlistConfiguration.configured,
    watchlistWorkerEnabled: watchlistConfiguration.monitorActive,
    settlementWorkerConfigured: settlementConfiguration.adminConfigured && settlementConfiguration.scoresProviderConfigured && settlementConfiguration.cronSecretConfigured,
    settlementWorkerEnabled: settlementConfiguration.monitorActive,
    autonomousAgentConfigured: autonomousConfiguration.adminConfigured && autonomousConfiguration.oddsProviderConfigured && autonomousConfiguration.cronSecretConfigured,
    autonomousAgentGloballyEnabled: autonomousConfiguration.agentActive,
    autonomousAgentUserEnabled: autonomousUserEnabled,
    autonomousAgentNotPaused: !autonomousPaused,
    autonomousAgentShadowLearningOnly: autonomousConfiguration.shadowLearningOnly,
    autonomousAgentProductionProbabilityUnchanged: autonomousConfiguration.productionProbabilityChangedByLearning === false,
    notificationDeliveryConfigured: deliveryConfiguration.adminConfigured && deliveryConfiguration.cronSecretConfigured,
    notificationDeliveryEnabled: deliveryConfiguration.deliveryActive,
    physicalPushDeviceRegistered: activeDevices.count > 0
  };

  return jsonResponse({
    ok: true,
    paperOnly: true,
    realMoneyBetting: false,
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
      autonomousAgent: {
        ...autonomousWorker,
        version: autonomousConfiguration.version,
        active: autonomousConfiguration.agentActive && autonomousUserEnabled && !autonomousPaused,
        intervalMinutes: autonomousConfiguration.intervalMinutes,
        adaptiveCadence: autonomousConfiguration.adaptiveCadence,
        shadowLearningOnly: autonomousConfiguration.shadowLearningOnly,
        productionProbabilityChangedByLearning: autonomousConfiguration.productionProbabilityChangedByLearning,
        userEnabled: autonomousUserEnabled,
        paused: autonomousPaused,
        healthStatus: autonomousState.data?.health_status || "learning",
        healthScore: Number(autonomousState.data?.health_score ?? 50),
        latestBrief: autonomousBrief.data?.brief || autonomousState.data?.last_brief || null,
        state: autonomousState.data || null,
        settings: autonomousSettings.data || null
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
      marketTimelineSnapshots24h: timeline24h.count,
      autonomousAgentRuns24h: autonomousRuns24h.count,
      autonomousAgentAuditRows24h: autonomousAudit24h.count
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
      autonomousAgent: {
        version: autonomousConfiguration.version,
        codeAvailable: autonomousConfiguration.codeAvailable,
        enabledFlag: autonomousConfiguration.enabledFlag,
        adminConfigured: autonomousConfiguration.adminConfigured,
        oddsProviderConfigured: autonomousConfiguration.oddsProviderConfigured,
        unifiedDataConfigured: autonomousConfiguration.unifiedDataConfigured,
        cronSecretConfigured: autonomousConfiguration.cronSecretConfigured,
        schedulingManagedExternally: autonomousConfiguration.schedulingManagedExternally,
        adaptiveCadence: autonomousConfiguration.adaptiveCadence,
        shadowLearningOnly: autonomousConfiguration.shadowLearningOnly,
        realMoneyBetting: autonomousConfiguration.realMoneyBetting
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
