import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../../lib/api-security";

export const dynamic = "force-dynamic";

function isMissingTable(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message || "");
}

function isMissingColumn(error) {
  return error?.code === "42703" || /column .* does not exist/i.test(error?.message || "");
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  const limited = await enforceRateLimit(auth, requestId, { bucket: "account_export", limit: 5, windowSeconds: 3600 });
  if (limited) return limited;

  const results = await Promise.all([
    auth.supabase.from("profiles").select("id,email,display_name,created_at,updated_at").eq("id", auth.user.id).maybeSingle(),
    auth.supabase.from("bets").select("id,client_ref,label,match,market,bookmaker,sport,league,home_team,away_team,odds,stake,edge,ev,confidence,status,result,profit,closing_odds,clv,raw_pick,created_at,updated_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(5000),
    auth.supabase.from("paper_settlement_monitor_state").select("*").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("bankroll_settings").select("*").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_settings").select("*").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_state").select("*").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_runs").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1000),
    auth.supabase.from("autonomous_agent_models").select("*").eq("user_id", auth.user.id).order("updated_at", { ascending: false }).limit(1000),
    auth.supabase.from("autonomous_agent_learning_snapshots").select("*").eq("user_id", auth.user.id).order("captured_at", { ascending: false }).limit(5000),
    auth.supabase.from("autonomous_agent_incidents").select("*").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(1000),
    auth.supabase.from("watchlist_items").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(500),
    auth.supabase.from("watchlist_monitor_state").select("*").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("alert_inbox").select("id,watchlist_id,fingerprint,alert_type,severity,title,message,match,selection,details,active,read_at,resolved_at,dismissed_at,first_seen_at,last_seen_at,created_at,updated_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(500),
    auth.supabase.from("market_timeline_snapshots").select("*").eq("user_id", auth.user.id).order("captured_at", { ascending: false }).limit(5000),
    auth.supabase.from("notification_preferences").select("*").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("notification_devices").select("id,platform,app_version,build_version,enabled,last_seen_at,created_at,updated_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(50),
    auth.supabase.from("notification_deliveries").select("id,alert_id,device_id,status,attempt_count,next_attempt_at,expo_ticket_id,ticket_status,receipt_status,error_code,error_message,queued_at,sent_at,receipt_checked_at,provider_accepted_at,failed_at,created_at,updated_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1000)
  ]);

  let [profileResult, betsResult, settlementMonitorResult, bankrollResult, autonomousSettingsResult, autonomousStateResult, autonomousRunsResult, autonomousModelsResult, autonomousLearningResult, autonomousIncidentsResult, watchlistResult, watchlistMonitorResult, alertInboxResult, timelineResult, preferencesResult, devicesResult, deliveriesResult] = results;
  if (alertInboxResult.error && isMissingColumn(alertInboxResult.error)) {
    alertInboxResult = await auth.supabase.from("alert_inbox").select("id,watchlist_id,fingerprint,alert_type,severity,title,message,match,selection,details,active,read_at,resolved_at,first_seen_at,last_seen_at,created_at,updated_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(500);
  }

  const errors = [profileResult.error, betsResult.error, bankrollResult.error].filter(Boolean);
  for (const result of [settlementMonitorResult, autonomousSettingsResult, autonomousStateResult, autonomousRunsResult, autonomousModelsResult, autonomousLearningResult, autonomousIncidentsResult, watchlistResult, watchlistMonitorResult, alertInboxResult, timelineResult, preferencesResult, devicesResult, deliveriesResult]) {
    if (result.error && !isMissingTable(result.error)) errors.push(result.error);
  }
  if (errors.length) return jsonResponse({ ok: false, error: publicError(errors[0], "Account data could not be exported") }, 500, requestId);

  return jsonResponse({
    ok: true,
    exportedAt: new Date().toISOString(),
    product: "Scorecaster",
    dataClassification: "paper tracking, Autonomous Intelligence V12.1 settings, model governance, learning snapshots, safety incidents, automatic settlement metadata, watchlist, market timeline, notification metadata and account data; no payment data",
    notificationDeliveryTokensExported: false,
    notificationReceiptMeaning: "provider acceptance only; not proof that the user saw the notification",
    autonomousAgentBoundary: "virtual paper decisions and paper-risk model governance only; no deposits, money movement, bookmaker access or real-money betting",
    account: { id: auth.user.id, email: auth.user.email || null, createdAt: auth.user.created_at || null },
    profile: profileResult.data || null,
    bankroll: bankrollResult.data || null,
    paperBets: betsResult.data || [],
    settlementMonitor: settlementMonitorResult.error ? null : settlementMonitorResult.data || null,
    autonomousAgentSettings: autonomousSettingsResult.error ? null : autonomousSettingsResult.data || null,
    autonomousAgentState: autonomousStateResult.error ? null : autonomousStateResult.data || null,
    autonomousAgentRuns: autonomousRunsResult.error ? [] : autonomousRunsResult.data || [],
    autonomousAgentModels: autonomousModelsResult.error ? [] : autonomousModelsResult.data || [],
    autonomousAgentLearningSnapshots: autonomousLearningResult.error ? [] : autonomousLearningResult.data || [],
    autonomousAgentIncidents: autonomousIncidentsResult.error ? [] : autonomousIncidentsResult.data || [],
    watchlist: watchlistResult.error ? [] : watchlistResult.data || [],
    watchlistMonitor: watchlistMonitorResult.error ? null : watchlistMonitorResult.data || null,
    alertInbox: alertInboxResult.error ? [] : (alertInboxResult.data || []).map((item) => ({ dismissed_at: null, ...item })),
    marketTimeline: timelineResult.error ? [] : timelineResult.data || [],
    notificationPreferences: preferencesResult.error ? null : preferencesResult.data || null,
    notificationDevices: devicesResult.error ? [] : devicesResult.data || [],
    notificationDeliveries: deliveriesResult.error ? [] : deliveriesResult.data || []
  }, 200, requestId);
}
