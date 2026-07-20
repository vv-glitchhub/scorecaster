import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../../lib/api-security";
import { watchlistMonitorConfiguration } from "../../../../lib/watchlist-monitor-config";

export const dynamic = "force-dynamic";

function missingTable(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message || "");
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "watchlist_monitor_status",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const { data, error } = await auth.supabase
    .from("watchlist_monitor_state")
    .select("next_check_at,last_started_at,last_completed_at,last_status,last_error,last_items_count,last_alerts_count,last_snapshots_count,updated_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const configuration = watchlistMonitorConfiguration();
  if (error && missingTable(error)) {
    return jsonResponse({
      ok: true,
      available: false,
      monitorActive: false,
      configured: configuration.configured,
      warning: "Watchlist Monitor migration is not active",
      state: null
    }, 200, requestId);
  }
  if (error) {
    return jsonResponse({
      ok: false,
      error: publicError(error, "Watchlist Monitor status could not be loaded")
    }, 500, requestId);
  }

  return jsonResponse({
    ok: true,
    available: true,
    monitorActive: configuration.monitorActive,
    configured: configuration.configured,
    schedulingManagedExternally: configuration.schedulingManagedExternally,
    intervalMinutes: configuration.intervalMinutes,
    state: data || null
  }, 200, requestId);
}