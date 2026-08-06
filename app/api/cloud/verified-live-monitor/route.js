import {
  boundedNumber,
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "../../../../lib/api-security";

export const dynamic = "force-dynamic";

const PREFERENCE_SELECT = "user_id,enabled,alerts_enabled,quiet_start,quiet_end,max_alerts_per_hour,minimum_probability_move,paper_only,created_at,updated_at";
const ALERT_SELECT = "id,watchlist_id,event_id,fingerprint,alert_type,severity,title,message,evidence,active,read_at,resolved_at,first_seen_at,last_seen_at,paper_only,created_at,updated_at";
const DEFAULT_PREFERENCES = Object.freeze({ enabled: true, alerts_enabled: true, quiet_start: null, quiet_end: null, max_alerts_per_hour: 3, minimum_probability_move: 0.05, paper_only: true });

function missingPatch(error) {
  return error?.code === "42P01" || /live_monitor_|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

function normalizeTime(value) {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return match ? `${match[1]}:${match[2]}:00` : undefined;
}

async function preferences(auth) {
  const { data, error } = await auth.supabase.from("live_monitor_preferences_v1").select(PREFERENCE_SELECT).eq("user_id", auth.user.id).maybeSingle();
  if (error && !missingPatch(error)) throw error;
  return { values: { ...DEFAULT_PREFERENCES, ...(data || {}) }, available: !error, warning: error ? "Verified Live Monitor production patch is not active" : null };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  const limited = await enforceRateLimit(auth, requestId, { bucket: "live_monitor_read", limit: 60, windowSeconds: 60 });
  if (limited) return limited;

  const url = new URL(request.url);
  const unknown = [...url.searchParams.keys()].filter((key) => !["eventId", "active"].includes(key));
  if (unknown.length) return jsonResponse({ ok: false, error: "Unsupported query parameter" }, 400, requestId);
  const eventId = cleanText(url.searchParams.get("eventId"), 180);
  const activeOnly = url.searchParams.get("active") !== "false";

  try {
    const preferenceState = await preferences(auth);
    let query = auth.supabase.from("live_monitor_alerts_v1").select(ALERT_SELECT).eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(500);
    if (eventId) query = query.eq("event_id", eventId);
    if (activeOnly) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw error;
    const alerts = data || [];
    return jsonResponse({
      ok: true,
      version: "scorecaster-verified-live-monitor-v1",
      preferences: preferenceState,
      alerts,
      summary: {
        total: alerts.length,
        unread: alerts.filter((row) => !row.read_at).length,
        high: alerts.filter((row) => row.severity === "high").length,
        medium: alerts.filter((row) => row.severity === "medium").length,
        suspended: alerts.filter((row) => row.alert_type === "provider-conflict" || row.alert_type === "invalid-regression").length
      },
      quietPeriodTimezone: "UTC",
      alertsInformationalOnly: true,
      realMoneyExecution: false,
      paperOnly: true
    }, 200, requestId, { "Cache-Control": "private, no-store" });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: missingPatch(error) ? "Verified Live Monitor production patch is not active" : "Live monitor alerts could not be loaded",
      requiredPatch: missingPatch(error) ? "scripts/apply-verified-live-monitor-v1.sql" : undefined,
      paperOnly: true
    }, missingPatch(error) ? 503 : 500, requestId);
  }
}

export async function PATCH(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  const limited = await enforceRateLimit(auth, requestId, { bucket: "live_monitor_write", limit: 20, windowSeconds: 60 });
  if (limited) return limited;
  const body = await readJsonBody(request, 12 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  try {
    if (body.data?.preference === true || body.data?.settings) {
      const source = body.data.settings || body.data;
      const quietStart = normalizeTime(source.quietStart ?? source.quiet_start);
      const quietEnd = normalizeTime(source.quietEnd ?? source.quiet_end);
      if (quietStart === undefined || quietEnd === undefined) return jsonResponse({ ok: false, error: "Quiet hours must use HH:MM format" }, 400, requestId);
      const row = {
        user_id: auth.user.id,
        enabled: source.enabled !== false,
        alerts_enabled: source.alertsEnabled !== false && source.alerts_enabled !== false,
        quiet_start: quietStart,
        quiet_end: quietEnd,
        max_alerts_per_hour: Math.round(boundedNumber(source.maxAlertsPerHour ?? source.max_alerts_per_hour, { min: 0, max: 6, fallback: 3 })),
        minimum_probability_move: boundedNumber(source.minimumProbabilityMove ?? source.minimum_probability_move, { min: 0.01, max: 0.25, fallback: 0.05 }),
        paper_only: true
      };
      const { data, error } = await auth.supabase.from("live_monitor_preferences_v1").upsert(row, { onConflict: "user_id" }).select(PREFERENCE_SELECT).single();
      if (error) throw error;
      return jsonResponse({ ok: true, preferences: data, quietPeriodTimezone: "UTC", paperOnly: true }, 200, requestId);
    }

    const id = cleanText(body.data?.id, 100);
    if (!id) return jsonResponse({ ok: false, error: "Alert id is required" }, 400, requestId);
    const changes = {};
    if (body.data?.read === true) changes.read_at = new Date().toISOString();
    if (body.data?.read === false) changes.read_at = null;
    if (body.data?.resolved === true) { changes.resolved_at = new Date().toISOString(); changes.active = false; }
    if (body.data?.active === false) changes.active = false;
    if (!Object.keys(changes).length) return jsonResponse({ ok: false, error: "No supported alert update supplied" }, 400, requestId);
    const { data, error } = await auth.supabase.from("live_monitor_alerts_v1").update(changes).eq("user_id", auth.user.id).eq("id", id).select(ALERT_SELECT).maybeSingle();
    if (error) throw error;
    if (!data) return jsonResponse({ ok: false, error: "Alert not found" }, 404, requestId);
    return jsonResponse({ ok: true, alert: data, paperOnly: true }, 200, requestId);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: missingPatch(error) ? "Verified Live Monitor production patch is not active" : "Live monitor settings could not be saved",
      requiredPatch: missingPatch(error) ? "scripts/apply-verified-live-monitor-v1.sql" : undefined,
      paperOnly: true
    }, missingPatch(error) ? 503 : 500, requestId);
  }
}
