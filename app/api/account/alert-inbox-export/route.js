import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../../lib/api-security";

export const dynamic = "force-dynamic";

function isMissingTable(error) {
  return error?.code === "42P01" || /does not exist/i.test(error?.message || "");
}

function isMissingColumn(error) {
  return error?.code === "42703" || /column .* does not exist/i.test(error?.message || "");
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "alert_inbox_export",
    limit: 5,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const [preferencesResult, initialInboxResult] = await Promise.all([
    auth.supabase
      .from("notification_preferences")
      .select("in_app_enabled,push_enabled,high_enabled,medium_enabled,info_enabled,kickoff_enabled,decision_enabled,price_enabled,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .maybeSingle(),
    auth.supabase
      .from("alert_inbox")
      .select("id,watchlist_id,fingerprint,alert_type,severity,title,message,match,selection,details,active,read_at,resolved_at,dismissed_at,first_seen_at,last_seen_at,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .order("last_seen_at", { ascending: false })
      .limit(1000)
  ]);

  let inboxResult = initialInboxResult;
  if (inboxResult.error && isMissingColumn(inboxResult.error)) {
    inboxResult = await auth.supabase
      .from("alert_inbox")
      .select("id,watchlist_id,fingerprint,alert_type,severity,title,message,match,selection,details,active,read_at,resolved_at,first_seen_at,last_seen_at,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .order("last_seen_at", { ascending: false })
      .limit(1000);
  }

  const errors = [];
  if (preferencesResult.error && !isMissingTable(preferencesResult.error)) errors.push(preferencesResult.error);
  if (inboxResult.error && !isMissingTable(inboxResult.error)) errors.push(inboxResult.error);
  if (errors.length) {
    return jsonResponse({ ok: false, error: publicError(errors[0], "Alert Inbox data could not be exported") }, 500, requestId);
  }

  return jsonResponse({
    ok: true,
    product: "Scorecaster",
    exportType: "alert-inbox-v2",
    exportedAt: new Date().toISOString(),
    userId: auth.user.id,
    notificationPreferences: preferencesResult.error ? null : preferencesResult.data || null,
    items: inboxResult.error ? [] : (inboxResult.data || []).map((item) => ({ dismissed_at: null, ...item }))
  }, 200, requestId);
}
