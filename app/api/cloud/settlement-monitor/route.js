import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../../../lib/api-security";
import { settlementMonitorConfiguration } from "../../../../../lib/settlement-monitor-config.js";

export const dynamic = "force-dynamic";

const SELECT = "next_check_at,lease_expires_at,last_started_at,last_completed_at,last_status,last_error,last_open_count,last_settled_count,last_pending_count,last_provider_warnings_count,created_at,updated_at";

function isMissingTable(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message || "");
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "settlement_monitor_read",
    limit: 60,
    windowSeconds: 60
  });
  if (limited) return limited;

  const configuration = settlementMonitorConfiguration();
  const { data, error } = await auth.supabase
    .from("paper_settlement_monitor_state")
    .select(SELECT)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error && !isMissingTable(error)) {
    return jsonResponse({ ok: false, error: publicError(error, "Settlement Monitor status could not be loaded") }, 500, requestId);
  }

  return jsonResponse({
    ok: true,
    paperOnly: true,
    available: !error,
    warning: error ? "Settlement Monitor migration is not active" : null,
    monitorActive: configuration.monitorActive,
    enabledFlag: configuration.enabledFlag,
    adminConfigured: configuration.adminConfigured,
    scoresProviderConfigured: configuration.scoresProviderConfigured,
    cronSecretConfigured: configuration.cronSecretConfigured,
    schedulingManagedExternally: configuration.schedulingManagedExternally,
    state: error ? null : data || null,
    limits: {
      usersPerRun: 20,
      openBetsPerUser: 100,
      sportsPerRun: 12,
      settlementsPerRun: 200,
      normalIntervalMinutes: 60,
      errorRetryMinutes: 15
    }
  }, 200, requestId);
}
