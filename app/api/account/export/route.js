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
    bucket: "account_export",
    limit: 5,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const results = await Promise.all([
    auth.supabase.from("profiles").select("id,email,display_name,created_at,updated_at").eq("id", auth.user.id).maybeSingle(),
    auth.supabase.from("bets").select("id,client_ref,label,match,market,bookmaker,sport,league,home_team,away_team,odds,stake,edge,ev,confidence,status,result,profit,closing_odds,clv,raw_pick,created_at,updated_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(5000),
    auth.supabase.from("paper_settlement_monitor_state").select("next_check_at,last_started_at,last_completed_at,last_status,last_error,last_open_count,last_settled_count,last_pending_count,last_provider_warnings_count,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("bankroll_settings").select("bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_settings").select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_state").select("next_check_at,last_started_at,last_completed_at,last_status,last_error,last_run_id,last_candidate_count,last_selected_count,last_saved_count,last_skipped_count,last_total_stake,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_runs").select("id,status,candidate_count,selected_count,saved_count,skipped_count,total_stake,sports,summary,error,started_at,completed_at,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1000),
    auth.supabase.from("autonomous_agent_v12_controls").select("kill_switch,autonomy_level,max_daily_loss_percent,max_drawdown_percent,max_loss_streak,allow_shadow_learning,allow_automatic_risk_tightening,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_v12_state").select("operating_state,policy,circuit_breakers,learning_report,shadow_champion_id,last_audit,last_learning_at,last_decision_at,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_v12_learning_cycles").select("id,status,sample_size,clv_sample,probability_sample,metrics,calibration,challenger,policy,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1000),
    auth.supabase.from("autonomous_agent_v12_audit").select("id,run_id,event_id,selection,action,reasons,evidence,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(5000),
    auth.supabase.from("watchlist_items").select("id,event_id,sport,league,market,selection,home_team,away_team,match,commence_time,added_odds,added_decision,alert_move_percent,alert_before_minutes,active,created_at,updated_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(500),
    auth.supabase.from("watchlist_monitor_state").select("next_check_at,last_started_at,last_completed_at,last_status,last_error,last_items_count,last_alerts_count,last_snapshots_count,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("alert_inbox").select("id,watchlist_id,fingerprint,alert_type,severity,title,message,match,selection,details,active,read_at,resolved_at,dismissed_at,first_seen_at,last_seen_at,created_at,updated_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(500),
    auth.supabase.from("market_timeline_snapshots").select("id,watchlist_id,event_id,sport,league,market,selection,odds,decision,consensus_probability,edge,ev,confidence,bookmaker,source,captured_at,created_at").eq("user_id", auth.user.id).order("captured_at", { ascending: false }).limit(5000),
    auth.supabase.from("notification_preferences").select("in_app_enabled,push_enabled,high_enabled,medium_enabled,info_enabled,kickoff_enabled,decision_enabled,price_enabled,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("notification_devices").select("id,platform,app_version,build_version,enabled,last_seen_at,created_at,updated_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(50),
    auth.supabase.from("notification_deliveries").select("id,alert_id,device_id,status,attempt_count,next_attempt_at,expo_ticket_id,ticket_status,receipt_status,error_code,error_message,queued_at,sent_at,receipt_checked_at,provider_accepted_at,failed_at,created_at,updated_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1000)
  ]);

  let [profileResult, betsResult, settlementMonitorResult, bankrollResult, autonomousSettingsResult, autonomousStateResult, autonomousRunsResult, autonomousV12ControlsResult, autonomousV12StateResult, autonomousV12LearningResult, autonomousV12AuditResult, watchlistResult, watchlistMonitorResult, alertInboxResult, timelineResult, preferencesResult, devicesResult, deliveriesResult] = results;
  if (alertInboxResult.error && isMissingColumn(alertInboxResult.error)) {
    alertInboxResult = await auth.supabase.from("alert_inbox").select("id,watchlist_id,fingerprint,alert_type,severity,title,message,match,selection,details,active,read_at,resolved_at,first_seen_at,last_seen_at,created_at,updated_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(500);
  }

  const errors = [profileResult.error, betsResult.error, bankrollResult.error].filter(Boolean);
  for (const result of [settlementMonitorResult, autonomousSettingsResult, autonomousStateResult, autonomousRunsResult, autonomousV12ControlsResult, autonomousV12StateResult, autonomousV12LearningResult, autonomousV12AuditResult, watchlistResult, watchlistMonitorResult, alertInboxResult, timelineResult, preferencesResult, devicesResult, deliveriesResult]) {
    if (result.error && !isMissingTable(result.error)) errors.push(result.error);
  }
  if (errors.length) {
    return jsonResponse({ ok: false, error: publicError(errors[0], "Account data could not be exported") }, 500, requestId);
  }

  return jsonResponse({
    ok: true,
    exportedAt: new Date().toISOString(),
    product: "Scorecaster",
    dataClassification: "paper-tracking, Autonomous V12 controls, learning and decision audit, automatic settlement metadata, model-audit snapshots, verified watchlist, background monitor metadata, market timeline, alert inbox, notification metadata and account data; no payment data",
    notificationDeliveryTokensExported: false,
    notificationReceiptMeaning: "provider acceptance only; not proof that the user saw the notification",
    autonomousAgentBoundary: "virtual paper decisions only; no deposits, money movement, bookmaker access or real-money betting",
    account: {
      id: auth.user.id,
      email: auth.user.email || null,
      createdAt: auth.user.created_at || null
    },
    profile: profileResult.data || null,
    bankroll: bankrollResult.data || null,
    paperBets: betsResult.data || [],
    settlementMonitor: settlementMonitorResult.error ? null : settlementMonitorResult.data || null,
    autonomousAgentSettings: autonomousSettingsResult.error ? null : autonomousSettingsResult.data || null,
    autonomousAgentState: autonomousStateResult.error ? null : autonomousStateResult.data || null,
    autonomousAgentRuns: autonomousRunsResult.error ? [] : autonomousRunsResult.data || [],
    autonomousV12Controls: autonomousV12ControlsResult.error ? null : autonomousV12ControlsResult.data || null,
    autonomousV12State: autonomousV12StateResult.error ? null : autonomousV12StateResult.data || null,
    autonomousV12LearningCycles: autonomousV12LearningResult.error ? [] : autonomousV12LearningResult.data || [],
    autonomousV12Audit: autonomousV12AuditResult.error ? [] : autonomousV12AuditResult.data || [],
    watchlist: watchlistResult.error ? [] : watchlistResult.data || [],
    watchlistMonitor: watchlistMonitorResult.error ? null : watchlistMonitorResult.data || null,
    alertInbox: alertInboxResult.error ? [] : (alertInboxResult.data || []).map((item) => ({ dismissed_at: null, ...item })),
    marketTimeline: timelineResult.error ? [] : timelineResult.data || [],
    notificationPreferences: preferencesResult.error ? null : preferencesResult.data || null,
    notificationDevices: devicesResult.error ? [] : devicesResult.data || [],
    notificationDeliveries: deliveriesResult.error ? [] : deliveriesResult.data || []
  }, 200, requestId);
}
