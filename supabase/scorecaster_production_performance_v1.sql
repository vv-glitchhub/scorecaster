-- Scorecaster production database performance V1
--
-- Purpose:
--   1. add covering indexes for every currently reported unindexed foreign key
--   2. preserve existing user-ownership RLS semantics while letting PostgreSQL
--      evaluate auth.uid() once per statement via (select auth.uid())
--   3. remove the four obsolete duplicate PUBLIC policies on bets
--   4. narrow legacy user_settings policies from PUBLIC to authenticated
--
-- Safety:
--   - no table, row, column or foreign-key changes
--   - no privilege grants or revokes
--   - no broader policy roles
--   - paper_only / paper_trading_mode checks are preserved
--   - no real-money execution capability is introduced

begin;

-- Foreign-key covering indexes reported by the production Supabase advisor on
-- 2026-08-15. These indexes improve parent UPDATE/DELETE checks and joins.
create index if not exists idx_scperf_ai_audit_trail_decision
  on public.ai_audit_trail (decision_id);
create index if not exists idx_scperf_autonomous_agent_audit_saved_bet
  on public.autonomous_agent_decision_audit (saved_bet_id);
create index if not exists idx_scperf_bankroll_entries_match
  on public.bankroll_entries (match_id);
create index if not exists idx_scperf_bet_slip_items_bet_slip
  on public.bet_slip_items (bet_slip_id);
create index if not exists idx_scperf_collector_records_run
  on public.collector_records (run_id);
create index if not exists idx_scperf_live_event_snapshots_run
  on public.live_event_snapshots_v1 (run_id);
create index if not exists idx_scperf_live_event_snapshots_supersedes
  on public.live_event_snapshots_v1 (supersedes_id);
create index if not exists idx_scperf_live_monitor_alerts_watchlist
  on public.live_monitor_alerts_v1 (watchlist_id);
create index if not exists idx_scperf_market_provider_snapshots_capture
  on public.market_provider_snapshots_v2 (capture_id);
create index if not exists idx_scperf_model_predictions_match
  on public.model_predictions (match_id);
create index if not exists idx_scperf_notification_deliveries_device
  on public.notification_deliveries (device_id);
create index if not exists idx_scperf_player_status_match
  on public.player_status (match_id);
create index if not exists idx_scperf_predictions_match
  on public.predictions (match_id);
create index if not exists idx_scperf_shadow_learning_samples_bet
  on public.shadow_learning_samples (bet_id);
create index if not exists idx_scperf_sports_analytics_observations_snapshot
  on public.sports_analytics_observations (snapshot_id);
create index if not exists idx_scperf_unified_closing_closing_snapshot
  on public.unified_data_closing_records (closing_snapshot_id);
create index if not exists idx_scperf_unified_closing_opening_snapshot
  on public.unified_data_closing_records (opening_snapshot_id);

-- Legacy per-command bets policies duplicate the reviewed authenticated ALL
-- policy. Their table grants are already authenticated-only; removing these
-- duplicate PUBLIC policies narrows evaluation work without reducing isolation.
drop policy if exists "Users can read own bets" on public.bets;
drop policy if exists "Users can insert own bets" on public.bets;
drop policy if exists "Users can update own bets" on public.bets;
drop policy if exists "Users can delete own bets" on public.bets;

alter policy "Users manage own bets" on public.bets
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Legacy user_settings policies are narrowed from PUBLIC to authenticated while
-- retaining the exact same ownership predicates.
alter policy "Users can read own settings" on public.user_settings
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own settings" on public.user_settings
  to authenticated
  with check ((select auth.uid()) = user_id);
alter policy "Users can update own settings" on public.user_settings
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- User-owned CRUD surfaces.
alter policy "Users manage own rows" on public.agent_feedback
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users read own AI Coach preferences" on public.ai_coach_preferences_v1
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users insert own AI Coach preferences" on public.ai_coach_preferences_v1
  to authenticated
  with check (((select auth.uid()) = user_id) and (paper_only = true));
alter policy "Users update own AI Coach preferences" on public.ai_coach_preferences_v1
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (((select auth.uid()) = user_id) and (paper_only = true));
alter policy "Users delete own AI Coach preferences" on public.ai_coach_preferences_v1
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users read own AI Coach reports" on public.ai_coach_reports_v1
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Users manage own alert inbox" on public.alert_inbox
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users read own autonomous agent daily briefs" on public.autonomous_agent_daily_briefs
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users read own autonomous agent decision audit" on public.autonomous_agent_decision_audit
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users read own autonomous agent runs" on public.autonomous_agent_runs
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users read own autonomous agent settings" on public.autonomous_agent_settings
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users insert own autonomous agent settings" on public.autonomous_agent_settings
  to authenticated
  with check ((select auth.uid()) = user_id);
alter policy "Users update own autonomous agent settings" on public.autonomous_agent_settings
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users read own autonomous agent state" on public.autonomous_agent_state
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Users manage own bankroll settings" on public.bankroll_settings
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (((select auth.uid()) = user_id) and (paper_trading_mode = true));

alter policy "Users manage own rows" on public.bet_slip_items
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users manage own rows" on public.bet_slips
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Authenticated users can create comments" on public.community_comments
  to authenticated
  with check ((select auth.uid()) = user_id);
alter policy "Users can update their own comments" on public.community_comments
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users can delete their own comments" on public.community_comments
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Users read own live monitor alerts" on public.live_monitor_alerts_v1
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users update own live monitor alerts" on public.live_monitor_alerts_v1
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (((select auth.uid()) = user_id) and (paper_only = true));
alter policy "Users delete own live monitor alerts" on public.live_monitor_alerts_v1
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Users read own live monitor preferences" on public.live_monitor_preferences_v1
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users insert own live monitor preferences" on public.live_monitor_preferences_v1
  to authenticated
  with check (((select auth.uid()) = user_id) and (paper_only = true));
alter policy "Users update own live monitor preferences" on public.live_monitor_preferences_v1
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (((select auth.uid()) = user_id) and (paper_only = true));
alter policy "Users delete own live monitor preferences" on public.live_monitor_preferences_v1
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Users manage own market timeline" on public.market_timeline_snapshots
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users read own notification delivery metadata" on public.notification_deliveries
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users manage own notification devices" on public.notification_devices
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users manage own notification preferences" on public.notification_preferences
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users manage own rows" on public.odds_snapshots
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users read own paper settlement monitor state" on public.paper_settlement_monitor_state
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users manage own rows" on public.pick_explanations
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users read own profile" on public.profiles
  to authenticated
  using ((select auth.uid()) = id);
alter policy "Users update own profile" on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "Users manage own rows" on public.risk_events
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users read own Shadow Learning cycles" on public.shadow_learning_cycles
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users read own Shadow Learning samples" on public.shadow_learning_samples
  to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Users read own Shadow Learning state" on public.shadow_learning_state
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Users manage own rows" on public.tracked_bets
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users manage own watchlist" on public.watchlist_items
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "Users read own watchlist monitor state" on public.watchlist_monitor_state
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

notify pgrst, 'reload schema';
