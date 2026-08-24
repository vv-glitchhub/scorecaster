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
    auth.supabase.from("live_monitor_preferences_v1").select("enabled,alerts_enabled,quiet_start,quiet_end,max_alerts_per_hour,minimum_probability_move,paper_only,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("live_monitor_alerts_v1").select("id,watchlist_id,event_id,fingerprint,alert_type,severity,title,message,evidence,active,read_at,resolved_at,first_seen_at,last_seen_at,paper_only,created_at,updated_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(5000),
    auth.supabase.from("ai_coach_preferences_v1").select("enabled,notifications_enabled,quiet_start,quiet_end,max_notifications_per_week,minimum_sample,paper_only,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("ai_coach_reports_v1").select("id,report_version,window_days,evidence_count,report,generated_at,paper_only,created_at").eq("user_id", auth.user.id).order("generated_at", { ascending: false }).limit(1000),
    auth.supabase.from("paper_settlement_monitor_state").select("next_check_at,last_started_at,last_completed_at,last_status,last_error,last_open_count,last_settled_count,last_pending_count,last_provider_warnings_count,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("bankroll_settings").select("bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_settings").select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_state").select("next_check_at,last_started_at,last_completed_at,last_status,last_error,last_run_id,last_candidate_count,last_selected_count,last_saved_count,last_skipped_count,last_total_stake,paused_until,pause_reason,health_status,health_score,resolved_sample,consecutive_losses,drawdown_percent,roi,average_clv,last_brief,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_runs").select("id,status,candidate_count,selected_count,saved_count,skipped_count,total_stake,sports,summary,guard_summary,health_status,health_score,next_check_minutes,error,started_at,completed_at,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1000),
    auth.supabase.from("autonomous_agent_decision_audit").select("id,run_id,event_id,match,selection,sport,league,allowed,reasons,warnings,quality_score,priority_score,odds,edge,confidence,data_coverage,provider_count,provider_disagreement,context_impact,minutes_before_start,proposed_stake,saved_bet_id,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(5000),
    auth.supabase.from("autonomous_agent_daily_briefs").select("id,brief_date,brief,created_at,updated_at").eq("user_id", auth.user.id).order("brief_date", { ascending: false }).limit(1000),
    auth.supabase.from("shadow_learning_samples").select("id,bet_id,event_id,match,selection,sport,league,market,agent_version,model_version,original_probability,selected_probability,market_probability,edge,ev,odds_at_selection,stake,initial_decision,final_decision,decision_reasons,data_sources_used,data_sources_unused,context_signals,provider_quality,provider_conflicts,risk_governor,decision_snapshot,settlement_status,result,closing_odds,clv,profit,settled_at,learning_mode,shadow_only,production_probability_changed,automatic_promotion_allowed,real_money_execution,created_at,updated_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(5000),
    auth.supabase.from("shadow_learning_state").select("next_check_at,last_started_at,last_completed_at,last_status,last_cycle_id,last_sample_size,last_clv_sample,review_ready,last_error,last_summary,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("shadow_learning_cycles").select("id,status,sample_size,clv_sample,metrics,calibration,segments,gates,promotion,safety,report,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1000),
    auth.supabase.from("watchlist_items").select("id,event_id,sport,league,market,selection,home_team,away_team,match,commence_time,added_odds,added_decision,alert_move_percent,alert_before_minutes,active,raw_pick,created_at,updated_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(500),
    auth.supabase.from("watchlist_monitor_state").select("next_check_at,last_started_at,last_completed_at,last_status,last_error,last_items_count,last_alerts_count,last_snapshots_count,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("auto_watch_recommendation_preferences").select("enabled,top_n,alert_move_percent,alert_before_minutes,next_sync_at,lease_expires_at,last_started_at,last_completed_at,last_status,last_error,last_synced_count,last_removed_count,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("alert_inbox").select("id,watchlist_id,fingerprint,alert_type,severity,title,message,match,selection,details,active,read_at,resolved_at,dismissed_at,first_seen_at,last_seen_at,created_at,updated_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(500),
    auth.supabase.from("market_timeline_snapshots").select("id,watchlist_id,event_id,sport,league,market,selection,odds,decision,consensus_probability,edge,ev,confidence,bookmaker,source,captured_at,created_at").eq("user_id", auth.user.id).order("captured_at", { ascending: false }).limit(5000),
    auth.supabase.from("notification_preferences").select("in_app_enabled,push_enabled,high_enabled,medium_enabled,info_enabled,kickoff_enabled,decision_enabled,price_enabled,created_at,updated_at").eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("notification_devices").select("id,platform,app_version,build_version,enabled,last_seen_at,created_at,updated_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(50),
    auth.supabase.from("notification_deliveries").select("id,alert_id,device_id,status,attempt_count,next_attempt_at,expo_ticket_id,ticket_status,receipt_status,error_code,error_message,queued_at,sent_at,receipt_checked_at,provider_accepted_at,failed_at,created_at,updated_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1000)
  ]);

  let [profileResult, betsResult, liveMonitorPreferencesResult, liveMonitorAlertsResult, aiCoachPreferencesResult, aiCoachReportsResult, settlementMonitorResult, bankrollResult, autonomousSettingsResult, autonomousStateResult, autonomousRunsResult, autonomousAuditResult, autonomousBriefsResult, shadowSamplesResult, shadowStateResult, shadowCyclesResult, watchlistResult, watchlistMonitorResult, autoWatchResult, alertInboxResult, timelineResult, preferencesResult, devicesResult, deliveriesResult] = results;
  if (alertInboxResult.error && isMissingColumn(alertInboxResult.error)) {
    alertInboxResult = await auth.supabase.from("alert_inbox").select("id,watchlist_id,fingerprint,alert_type,severity,title,message,match,selection,details,active,read_at,resolved_at,first_seen_at,last_seen_at,created_at,updated_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(500);
  }

  const errors = [profileResult.error, betsResult.error, bankrollResult.error].filter(Boolean);
  for (const result of [liveMonitorPreferencesResult, liveMonitorAlertsResult, aiCoachPreferencesResult, aiCoachReportsResult, settlementMonitorResult, autonomousSettingsResult, autonomousStateResult, autonomousRunsResult, autonomousAuditResult, autonomousBriefsResult, shadowSamplesResult, shadowStateResult, shadowCyclesResult, watchlistResult, watchlistMonitorResult, autoWatchResult, alertInboxResult, timelineResult, preferencesResult, devicesResult, deliveriesResult]) {
    if (result.error && !isMissingTable(result.error)) errors.push(result.error);
  }
  if (errors.length) {
    return jsonResponse({ ok: false, error: publicError(errors[0], "Account data could not be exported") }, 500, requestId);
  }

  return jsonResponse({
    ok: true,
    exportedAt: new Date().toISOString(),
    product: "Scorecaster",
    dataClassification: "paper-tracking, Verified Live Monitor preferences and personal alert evidence, AI Coach preferences and evidence reports, Autonomous Scorecaster V13 settings, safety health, candidate decision audit, daily autonomous briefs, immutable Shadow Learning observations, evaluation cycles, automatic settlement metadata, model-audit snapshots, verified watchlist, Auto-Watch recommendation preferences and provenance, background monitor metadata, market timeline, alert inbox, notification metadata and account data; no payment data",
    notificationDeliveryTokensExported: false,
    notificationReceiptMeaning: "provider acceptance only; not proof that the user saw the notification",
    liveMonitorBoundary: "informational timestamped event-state and provider-freshness evidence; no pre-match model change, stake suggestion, bookmaker account access or real-money execution",
    aiCoachBoundary: "evidence-based coaching from the user's own paper records; no model, decision or stake modification, loss chasing, real-money execution or profit guarantee",
    autonomousAgentBoundary: "virtual paper decisions and shadow-only learning; no deposits, money movement, bookmaker access, automatic model promotion or real-money betting",
    account: {
      id: auth.user.id,
      email: auth.user.email || null,
      createdAt: auth.user.created_at || null
    },
    profile: profileResult.data || null,
    bankroll: bankrollResult.data || null,
    paperBets: betsResult.data || [],
    liveMonitorPreferences: liveMonitorPreferencesResult.error ? null : liveMonitorPreferencesResult.data || null,
    liveMonitorAlerts: liveMonitorAlertsResult.error ? [] : liveMonitorAlertsResult.data || [],
    aiCoachPreferences: aiCoachPreferencesResult.error ? null : aiCoachPreferencesResult.data || null,
    aiCoachReports: aiCoachReportsResult.error ? [] : aiCoachReportsResult.data || [],
    settlementMonitor: settlementMonitorResult.error ? null : settlementMonitorResult.data || null,
    autonomousAgentSettings: autonomousSettingsResult.error ? null : autonomousSettingsResult.data || null,
    autonomousAgentState: autonomousStateResult.error ? null : autonomousStateResult.data || null,
    autonomousAgentRuns: autonomousRunsResult.error ? [] : autonomousRunsResult.data || [],
    autonomousAgentDecisionAudit: autonomousAuditResult.error ? [] : autonomousAuditResult.data || [],
    autonomousAgentDailyBriefs: autonomousBriefsResult.error ? [] : autonomousBriefsResult.data || [],
    shadowLearningSamples: shadowSamplesResult.error ? [] : shadowSamplesResult.data || [],
    shadowLearningState: shadowStateResult.error ? null : shadowStateResult.data || null,
    shadowLearningCycles: shadowCyclesResult.error ? [] : shadowCyclesResult.data || [],
    watchlist: watchlistResult.error ? [] : watchlistResult.data || [],
    watchlistMonitor: watchlistMonitorResult.error ? null : watchlistMonitorResult.data || null,
    autoWatchRecommendations: autoWatchResult.error ? null : autoWatchResult.data || null,
    alertInbox: alertInboxResult.error ? [] : (alertInboxResult.data || []).map((item) => ({ dismissed_at: null, ...item })),
    marketTimeline: timelineResult.error ? [] : timelineResult.data || [],
    notificationPreferences: preferencesResult.error ? null : preferencesResult.data || null,
    notificationDevices: devicesResult.error ? [] : devicesResult.data || [],
    notificationDeliveries: deliveriesResult.error ? [] : deliveriesResult.data || []
  }, 200, requestId);
}
