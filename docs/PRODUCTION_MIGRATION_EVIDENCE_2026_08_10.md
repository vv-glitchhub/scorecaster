# Scorecaster production migration evidence — 2026-08-10

## Scope

Production project: `rsukfxhgqzpofiszjtbf`

Verification time: `2026-08-10T18:08:10.087375Z`

This is a read-only, object-level production catalog verification of the 21 canonical Scorecaster Supabase migrations in `config/release-readiness.json`. No application rows, tokens, credentials, bookmaker accounts or payment data were read. The audit checked the distinctive tables, indexes, functions, triggers, RLS state, policies and role boundaries required by each migration.

Later migrations and the production Public Schema Hardening V1.3 intentionally replace or narrow some earlier function definitions and grants. In those cases this evidence verifies that the earlier migration's structural contract exists and that the current production state is at least as restrictive as the reviewed contract.

Scorecaster remains paper-only.

## Canonical migration evidence

### scorecaster_schema

`supabase/scorecaster_schema.sql`

Verified all 8 base tables: `bankroll_settings`, `bet_slips`, `bet_slip_items`, `tracked_bets`, `odds_snapshots`, `pick_explanations`, `agent_feedback`, `risk_events`. Verified the four named production indexes from the migration.

### scorecaster_auth_cloud

`supabase/scorecaster_auth_cloud.sql`

Verified `profiles`, `bets` and `bankroll_settings`; the expected indexes; `set_updated_at`, `enforce_paper_stake_limit` and `handle_new_user`; the three public update triggers plus the paper-stake trigger; the `auth.users` profile trigger; FORCE RLS on the reviewed account tables; and the reviewed ownership policies. Profile INSERT remains server/database-owned after V1.3 hardening.

### scorecaster_community_feed_v1

`supabase/scorecaster_community_feed_v1.sql`

Verified `community_comments`, both event/user indexes, RLS and all four public-read/authenticated-owner mutation policies.

### scorecaster_paper_risk_limits

`supabase/scorecaster_paper_risk_limits.sql`

Verified `enforce_paper_stake_limit()` as SECURITY DEFINER and the current `bets_enforce_paper_stake_limit` trigger covering `stake`, `user_id`, `status`, `league`, `edge`, `confidence` and `raw_pick`.

### scorecaster_api_rate_limits

`supabase/scorecaster_api_rate_limits.sql`

Verified `api_rate_limits`, its updated-at index, FORCE RLS, `consume_api_quota(text,integer,integer)` and `delete_stale_api_rate_limits()`. Authenticated execution remains allowed only for `consume_api_quota`; the cleanup RPC is closed to authenticated clients.

### scorecaster_watchlist_alerts

`supabase/scorecaster_watchlist_alerts.sql`

Verified `watchlist_items`, both indexes, `set_watchlist_updated_at()`, the update trigger, FORCE RLS and the user-ownership policy.

### scorecaster_market_timeline

`supabase/scorecaster_market_timeline.sql`

Verified `market_timeline_snapshots`, both indexes, FORCE RLS and the user-ownership policy.

### scorecaster_alert_inbox

`supabase/scorecaster_alert_inbox.sql`

Verified `alert_inbox`, all five named indexes, `set_alert_inbox_updated_at()`, its trigger, FORCE RLS and the user-ownership policy.

### scorecaster_notification_registry

`supabase/scorecaster_notification_registry.sql`

Verified `notification_preferences` and `notification_devices`, both device indexes, all four reviewed functions including `claim_notification_device`, all five triggers, FORCE RLS, both ownership policies and authenticated execution of the device-claim RPC.

### scorecaster_notification_delivery

`supabase/scorecaster_notification_delivery.sql`

Verified `notification_deliveries`, all four indexes, updated-at and claim functions, the update trigger, FORCE RLS and the user read-only policy. `claim_notification_deliveries(integer)` is executable by `service_role` and closed to `anon`/`authenticated`.

### scorecaster_watchlist_monitor

`supabase/scorecaster_watchlist_monitor.sql`

Verified `watchlist_monitor_state`, due index, all four monitor functions, state/watchlist scheduling triggers, FORCE RLS, the user read-only policy and service-role execution of claim/complete worker RPCs.

### scorecaster_decision_diagnostics

`supabase/scorecaster_decision_diagnostics.sql`

Verified `decision_diagnostic_snapshots` and `decision_diagnostic_alerts`, all five named indexes, alert updated-at function/trigger, FORCE RLS and the two authenticated read-only policies.

### scorecaster_collector_v1

`supabase/scorecaster_collector_v1.sql`

Verified `collector_runs` and `collector_records`, all six indexes, FORCE RLS, zero direct browser read access and full reviewed CRUD access for `service_role`.

### scorecaster_ai_intelligence_v1

`supabase/scorecaster_ai_intelligence_v1.sql`

Verified `intelligence_items` and `intelligence_reports`, all three indexes and RLS. Public Schema Hardening V1.3 has additionally closed direct browser grants on these internal tables.

### scorecaster_unified_data

`supabase/scorecaster_unified_data.sql`

Verified all four Unified Data tables, all 12 named indexes, `set_unified_data_updated_at()`, both update triggers, FORCE RLS and all four authenticated read-only policies.

### scorecaster_sports_analytics

`supabase/scorecaster_sports_analytics.sql`

Verified both Sports Analytics tables, all seven named indexes, FORCE RLS, zero direct browser read access and reviewed CRUD access for `service_role`.

### scorecaster_settlement_monitor

`supabase/scorecaster_settlement_monitor.sql`

Verified `paper_settlement_monitor_state`, due index, all four monitor functions, both triggers, FORCE RLS and the user read-only policy. Claim/complete RPCs are executable by `service_role`.

### scorecaster_autonomous_agent

`supabase/scorecaster_autonomous_agent.sql`

Verified `autonomous_agent_settings`, `autonomous_agent_state`, `autonomous_agent_runs`, both base indexes, all five reviewed V1 functions, all three base triggers, FORCE RLS, the five user policies, service-role claim execution and authenticated manual-run request execution.

### scorecaster_autonomous_agent_v2

`supabase/scorecaster_autonomous_agent_v2.sql`

Verified `autonomous_agent_decision_audit` and `autonomous_agent_daily_briefs`, all four V2 indexes, all 14 V2 settings columns, all 10 V2 state health/pause columns, `set_autonomous_agent_brief_updated_at()`, `complete_autonomous_agent_user_v2(...)`, the brief trigger, FORCE RLS, both read-only policies and service-role complete execution.

### scorecaster_autonomous_v13_hard_caps

`supabase/scorecaster_autonomous_v13_hard_caps.sql`

Verified `enforce_autonomous_v13_hard_caps()` as SECURITY DEFINER and `bets_enforce_autonomous_v13_hard_caps`. Direct `anon` and `authenticated` EXECUTE access is closed after V1.3 hardening.

### scorecaster_shadow_learning_v1

`supabase/scorecaster_shadow_learning_v1.sql`

Verified `shadow_learning_samples`, `shadow_learning_state`, `shadow_learning_cycles`, all five indexes, six reviewed helper/worker functions, all three triggers, FORCE RLS, all three user read-only policies, service-role claim/complete execution and the `shadow_learning_sample_safety_boundary` constraint. The safety boundary keeps samples shadow-only, forbids production-probability mutation and forbids automatic promotion/real-money execution.

## Result

All 21 canonical migration contracts were present in the production database at the verification timestamp. The migration registry can therefore be marked `applied` with this document as the non-secret object-level evidence reference.

This evidence does **not** replace the separate controlled two-user RLS isolation test, concurrent hard-cap test, protected-worker runtime probes, provider activation evidence or external security review.
