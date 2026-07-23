\set ON_ERROR_STOP on

-- Scorecaster Production Schema Verification V3
-- Read-only checks. Any failed assertion aborts the activation workflow.

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
    'profiles',
    'bets',
    'bankroll_settings',
    'watchlist_items',
    'watchlist_monitor_state',
    'decision_diagnostic_snapshots',
    'decision_diagnostic_alerts',
    'unified_data_snapshots',
    'unified_data_provider_observations',
    'unified_data_closing_records',
    'unified_data_incidents',
    'paper_settlement_monitor_state',
    'autonomous_agent_settings',
    'autonomous_agent_state',
    'autonomous_agent_runs',
    'autonomous_agent_decision_audit',
    'autonomous_agent_daily_briefs',
    'shadow_learning_samples',
    'shadow_learning_state',
    'shadow_learning_cycles',
    'market_timeline_snapshots',
    'alert_inbox',
    'notification_preferences',
    'notification_devices',
    'notification_deliveries'
  ]) as expected(table_name)
  where to_regclass(format('public.%I', table_name)) is null;

  if missing_tables is not null then
    raise exception 'Missing Scorecaster production tables: %', array_to_string(missing_tables, ', ');
  end if;
end;
$$;

do $$
declare
  insecure_tables text[];
begin
  select array_agg(c.relname order by c.relname)
  into insecure_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'profiles',
      'bets',
      'bankroll_settings',
      'watchlist_items',
      'watchlist_monitor_state',
      'decision_diagnostic_snapshots',
      'decision_diagnostic_alerts',
      'unified_data_snapshots',
      'unified_data_provider_observations',
      'unified_data_closing_records',
      'unified_data_incidents',
      'paper_settlement_monitor_state',
      'autonomous_agent_settings',
      'autonomous_agent_state',
      'autonomous_agent_runs',
      'autonomous_agent_decision_audit',
      'autonomous_agent_daily_briefs',
      'shadow_learning_samples',
      'shadow_learning_state',
      'shadow_learning_cycles',
      'market_timeline_snapshots',
      'alert_inbox',
      'notification_preferences',
      'notification_devices',
      'notification_deliveries'
    ])
    and (not c.relrowsecurity or not c.relforcerowsecurity);

  if insecure_tables is not null then
    raise exception 'RLS or FORCE RLS is missing from: %', array_to_string(insecure_tables, ', ');
  end if;
end;
$$;

do $$
declare
  tables_without_policies text[];
begin
  select array_agg(table_name order by table_name)
  into tables_without_policies
  from unnest(array[
    'profiles',
    'bets',
    'bankroll_settings',
    'watchlist_items',
    'watchlist_monitor_state',
    'decision_diagnostic_snapshots',
    'decision_diagnostic_alerts',
    'unified_data_snapshots',
    'unified_data_provider_observations',
    'unified_data_closing_records',
    'unified_data_incidents',
    'paper_settlement_monitor_state',
    'autonomous_agent_settings',
    'autonomous_agent_state',
    'autonomous_agent_runs',
    'autonomous_agent_decision_audit',
    'autonomous_agent_daily_briefs',
    'shadow_learning_samples',
    'shadow_learning_state',
    'shadow_learning_cycles',
    'market_timeline_snapshots',
    'alert_inbox',
    'notification_preferences',
    'notification_devices',
    'notification_deliveries'
  ]) as expected(table_name)
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = expected.table_name
  );

  if tables_without_policies is not null then
    raise exception 'RLS policies are missing from: %', array_to_string(tables_without_policies, ', ');
  end if;
end;
$$;

do $$
begin
  if to_regprocedure('public.claim_watchlist_monitor_users(integer)') is null then
    raise exception 'Watchlist Monitor claim function is missing';
  end if;
  if to_regprocedure('public.complete_watchlist_monitor_user(uuid,text,integer,integer,integer,text)') is null then
    raise exception 'Watchlist Monitor completion function is missing';
  end if;
  if to_regprocedure('public.claim_paper_settlement_monitor_users(integer)') is null then
    raise exception 'Settlement Monitor claim function is missing';
  end if;
  if to_regprocedure('public.complete_paper_settlement_monitor_user(uuid,text,integer,integer,integer,integer,text)') is null then
    raise exception 'Settlement Monitor completion function is missing';
  end if;
  if to_regprocedure('public.claim_autonomous_agent_users(integer)') is null then
    raise exception 'Autonomous Agent claim function is missing';
  end if;
  if to_regprocedure('public.complete_autonomous_agent_user(uuid,text,uuid,integer,integer,integer,integer,numeric,text)') is null then
    raise exception 'Autonomous Agent V1 completion function is missing';
  end if;
  if to_regprocedure('public.complete_autonomous_agent_user_v2(uuid,text,uuid,integer,integer,integer,integer,numeric,text,integer,text,numeric,integer,integer,numeric,numeric,numeric,integer,text,jsonb)') is null then
    raise exception 'Autonomous Agent V2 completion function is missing';
  end if;
  if to_regprocedure('public.request_autonomous_agent_run()') is null then
    raise exception 'Autonomous Agent user request function is missing';
  end if;
  if to_regprocedure('public.claim_shadow_learning_users(integer)') is null then
    raise exception 'Shadow Learning claim function is missing';
  end if;
  if to_regprocedure('public.complete_shadow_learning_user(uuid,text,uuid,integer,integer,boolean,text,jsonb)') is null then
    raise exception 'Shadow Learning completion function is missing';
  end if;
  if to_regprocedure('public.sync_shadow_learning_sample(uuid)') is null then
    raise exception 'Shadow Learning sample synchronization function is missing';
  end if;
end;
$$;

do $$
begin
  if not has_function_privilege('service_role', 'public.claim_watchlist_monitor_users(integer)', 'EXECUTE') then
    raise exception 'service_role cannot claim Watchlist Monitor users';
  end if;
  if not has_function_privilege('service_role', 'public.claim_paper_settlement_monitor_users(integer)', 'EXECUTE') then
    raise exception 'service_role cannot claim Settlement Monitor users';
  end if;
  if not has_function_privilege('service_role', 'public.claim_autonomous_agent_users(integer)', 'EXECUTE') then
    raise exception 'service_role cannot claim Autonomous Agent users';
  end if;
  if not has_function_privilege('service_role', 'public.complete_autonomous_agent_user_v2(uuid,text,uuid,integer,integer,integer,integer,numeric,text,integer,text,numeric,integer,integer,numeric,numeric,numeric,integer,text,jsonb)', 'EXECUTE') then
    raise exception 'service_role cannot complete Autonomous Agent V2 users';
  end if;
  if not has_function_privilege('service_role', 'public.claim_shadow_learning_users(integer)', 'EXECUTE') then
    raise exception 'service_role cannot claim Shadow Learning users';
  end if;
  if not has_function_privilege('service_role', 'public.complete_shadow_learning_user(uuid,text,uuid,integer,integer,boolean,text,jsonb)', 'EXECUTE') then
    raise exception 'service_role cannot complete Shadow Learning users';
  end if;
  if not has_function_privilege('service_role', 'public.sync_shadow_learning_sample(uuid)', 'EXECUTE') then
    raise exception 'service_role cannot synchronize Shadow Learning samples';
  end if;
  if not has_function_privilege('authenticated', 'public.request_autonomous_agent_run()', 'EXECUTE') then
    raise exception 'authenticated users cannot request their own Autonomous Agent run';
  end if;
  if has_table_privilege('authenticated', 'public.autonomous_agent_settings', 'DELETE') then
    raise exception 'authenticated users must not delete Autonomous Agent settings directly';
  end if;
  if not has_table_privilege('service_role', 'public.autonomous_agent_decision_audit', 'INSERT') then
    raise exception 'service_role cannot write Autonomous Agent V2 decision audit';
  end if;
  if not has_table_privilege('service_role', 'public.autonomous_agent_daily_briefs', 'UPDATE') then
    raise exception 'service_role cannot update Autonomous Agent V2 daily briefs';
  end if;
  if has_table_privilege('authenticated', 'public.autonomous_agent_decision_audit', 'INSERT') then
    raise exception 'authenticated users must not write Autonomous Agent V2 decision audit';
  end if;
  if has_table_privilege('authenticated', 'public.autonomous_agent_daily_briefs', 'UPDATE') then
    raise exception 'authenticated users must not update Autonomous Agent V2 daily briefs';
  end if;
  if not has_table_privilege('service_role', 'public.shadow_learning_samples', 'INSERT') then
    raise exception 'service_role cannot write Shadow Learning samples';
  end if;
  if not has_table_privilege('service_role', 'public.shadow_learning_cycles', 'INSERT') then
    raise exception 'service_role cannot write Shadow Learning cycles';
  end if;
  if has_table_privilege('authenticated', 'public.shadow_learning_samples', 'INSERT') then
    raise exception 'authenticated users must not write Shadow Learning samples';
  end if;
  if has_table_privilege('authenticated', 'public.shadow_learning_samples', 'UPDATE') then
    raise exception 'authenticated users must not alter immutable Shadow Learning samples';
  end if;
  if has_table_privilege('authenticated', 'public.shadow_learning_cycles', 'INSERT') then
    raise exception 'authenticated users must not write Shadow Learning cycles';
  end if;
  if not has_table_privilege('service_role', 'public.decision_diagnostic_snapshots', 'INSERT') then
    raise exception 'service_role cannot write Decision Diagnostics snapshots';
  end if;
  if not has_table_privilege('service_role', 'public.decision_diagnostic_alerts', 'UPDATE') then
    raise exception 'service_role cannot update Decision Diagnostics alerts';
  end if;
  if has_table_privilege('authenticated', 'public.decision_diagnostic_snapshots', 'INSERT') then
    raise exception 'authenticated users must not write shared Decision Diagnostics snapshots';
  end if;
  if has_table_privilege('authenticated', 'public.decision_diagnostic_alerts', 'UPDATE') then
    raise exception 'authenticated users must not update shared Decision Diagnostics alerts';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'bets'
      and t.tgname = 'bets_enforce_paper_stake_limit'
      and not t.tgisinternal
  ) then
    raise exception 'Database paper-risk enforcement trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'bets'
      and t.tgname = 'bets_capture_shadow_learning'
      and not t.tgisinternal
  ) then
    raise exception 'Shadow Learning capture trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'autonomous_agent_settings'
      and t.tgname = 'autonomous_agent_settings_schedule'
      and not t.tgisinternal
  ) then
    raise exception 'Autonomous Agent scheduling trigger is missing';
  end if;
end;
$$;

do $$
declare
  unsafe_shadow_rows integer;
begin
  select count(*) into unsafe_shadow_rows
  from public.shadow_learning_samples
  where learning_mode <> 'shadow-only'
     or shadow_only is not true
     or production_probability_changed is not false
     or real_money_execution is not false;

  if unsafe_shadow_rows > 0 then
    raise exception 'Shadow Learning contains % row(s) outside the paper-only safety boundary', unsafe_shadow_rows;
  end if;
end;
$$;

do $$
declare
  anonymous_exposure text[];
begin
  select array_agg(table_name order by table_name)
  into anonymous_exposure
  from unnest(array[
    'bets',
    'bankroll_settings',
    'watchlist_items',
    'watchlist_monitor_state',
    'decision_diagnostic_snapshots',
    'decision_diagnostic_alerts',
    'unified_data_snapshots',
    'unified_data_provider_observations',
    'unified_data_closing_records',
    'unified_data_incidents',
    'paper_settlement_monitor_state',
    'autonomous_agent_settings',
    'autonomous_agent_state',
    'autonomous_agent_runs',
    'autonomous_agent_decision_audit',
    'autonomous_agent_daily_briefs',
    'shadow_learning_samples',
    'shadow_learning_state',
    'shadow_learning_cycles',
    'market_timeline_snapshots',
    'alert_inbox',
    'notification_preferences',
    'notification_devices',
    'notification_deliveries'
  ]) as expected(table_name)
  where has_table_privilege('anon', format('public.%I', table_name), 'SELECT');

  if anonymous_exposure is not null then
    raise exception 'Anonymous role can read protected tables: %', array_to_string(anonymous_exposure, ', ');
  end if;
end;
$$;

select json_build_object(
  'ok', true,
  'version', 'production-schema-verification-v3',
  'paperOnly', true,
  'rlsVerified', true,
  'workerFunctionsVerified', true,
  'databaseRiskTriggerVerified', true,
  'diagnosticsVerified', true,
  'unifiedDataVerified', true,
  'autonomousAgentV2Verified', true,
  'shadowLearningVerified', true,
  'realMoneyBetting', false,
  'verifiedAt', now()
) as scorecaster_production_schema;
