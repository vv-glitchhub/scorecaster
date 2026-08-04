\set ON_ERROR_STOP on

-- Scorecaster production migration evidence export V1
-- Read-only metadata inspection. This query does not read application rows,
-- modify schema objects or expose secrets.

with public_tables as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as force_rls,
    coalesce((
      select count(*)
      from pg_policies p
      where p.schemaname = n.nspname
        and p.tablename = c.relname
    ), 0) as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
), public_policies as (
  select
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
  from pg_policies
  where schemaname = 'public'
), public_functions as (
  select
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_result(p.oid) as result_type,
    l.lanname as language,
    p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
), public_triggers as (
  select
    c.relname as table_name,
    t.tgname as trigger_name,
    pg_get_triggerdef(t.oid, true) as definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal
), public_indexes as (
  select
    tablename,
    indexname,
    indexdef
  from pg_indexes
  where schemaname = 'public'
), required_objects as (
  select *
  from (values
    ('table', 'profiles', to_regclass('public.profiles') is not null),
    ('table', 'bets', to_regclass('public.bets') is not null),
    ('table', 'bankroll_settings', to_regclass('public.bankroll_settings') is not null),
    ('table', 'community_comments', to_regclass('public.community_comments') is not null),
    ('table', 'intelligence_items', to_regclass('public.intelligence_items') is not null),
    ('table', 'intelligence_reports', to_regclass('public.intelligence_reports') is not null),
    ('table', 'watchlist_items', to_regclass('public.watchlist_items') is not null),
    ('table', 'decision_diagnostic_snapshots', to_regclass('public.decision_diagnostic_snapshots') is not null),
    ('table', 'collector_observations', to_regclass('public.collector_observations') is not null),
    ('table', 'unified_data_snapshots', to_regclass('public.unified_data_snapshots') is not null),
    ('table', 'sports_analytics_observations', to_regclass('public.sports_analytics_observations') is not null),
    ('table', 'paper_settlement_monitor_state', to_regclass('public.paper_settlement_monitor_state') is not null),
    ('table', 'autonomous_agent_settings', to_regclass('public.autonomous_agent_settings') is not null),
    ('table', 'autonomous_agent_decision_audit', to_regclass('public.autonomous_agent_decision_audit') is not null),
    ('table', 'shadow_learning_samples', to_regclass('public.shadow_learning_samples') is not null),
    ('function', 'claim_watchlist_monitor_users(integer)', to_regprocedure('public.claim_watchlist_monitor_users(integer)') is not null),
    ('function', 'claim_paper_settlement_monitor_users(integer)', to_regprocedure('public.claim_paper_settlement_monitor_users(integer)') is not null),
    ('function', 'claim_autonomous_agent_users(integer)', to_regprocedure('public.claim_autonomous_agent_users(integer)') is not null),
    ('function', 'claim_shadow_learning_users(integer)', to_regprocedure('public.claim_shadow_learning_users(integer)') is not null)
  ) as expected(object_type, object_name, present)
)
select jsonb_pretty(jsonb_build_object(
  'schemaVersion', 1,
  'product', 'Scorecaster',
  'environment', 'production',
  'capturedAt', now(),
  'databaseVersion', current_setting('server_version'),
  'paperOnly', true,
  'containsApplicationRows', false,
  'requiredObjects', coalesce((select jsonb_agg(to_jsonb(required_objects) order by object_type, object_name) from required_objects), '[]'::jsonb),
  'tables', coalesce((select jsonb_agg(to_jsonb(public_tables) order by table_name) from public_tables), '[]'::jsonb),
  'policies', coalesce((select jsonb_agg(to_jsonb(public_policies) order by tablename, policyname) from public_policies), '[]'::jsonb),
  'functions', coalesce((select jsonb_agg(to_jsonb(public_functions) order by function_name, identity_arguments) from public_functions), '[]'::jsonb),
  'triggers', coalesce((select jsonb_agg(to_jsonb(public_triggers) order by table_name, trigger_name) from public_triggers), '[]'::jsonb),
  'indexes', coalesce((select jsonb_agg(to_jsonb(public_indexes) order by tablename, indexname) from public_indexes), '[]'::jsonb)
)) as scorecaster_production_migration_evidence;
