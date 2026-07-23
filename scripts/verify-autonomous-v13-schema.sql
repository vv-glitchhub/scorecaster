\set ON_ERROR_STOP on

-- Autonomous Scorecaster V13 production schema verification.
-- Read-only and fail-fast. Run after the base Scorecaster schema verifier.

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
    'autonomous_agent_decision_audit',
    'autonomous_agent_daily_briefs'
  ]) as expected(table_name)
  where to_regclass(format('public.%I', table_name)) is null;

  if missing_tables is not null then
    raise exception 'Missing Autonomous V13 tables: %', array_to_string(missing_tables, ', ');
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
      'autonomous_agent_decision_audit',
      'autonomous_agent_daily_briefs'
    ])
    and (not c.relrowsecurity or not c.relforcerowsecurity);

  if insecure_tables is not null then
    raise exception 'Autonomous V13 RLS or FORCE RLS is missing from: %', array_to_string(insecure_tables, ', ');
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
    'autonomous_agent_decision_audit',
    'autonomous_agent_daily_briefs'
  ]) as expected(table_name)
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = expected.table_name
  );

  if tables_without_policies is not null then
    raise exception 'Autonomous V13 RLS policies are missing from: %', array_to_string(tables_without_policies, ', ');
  end if;
end;
$$;

do $$
begin
  if to_regprocedure('public.complete_autonomous_agent_user_v2(uuid,text,uuid,integer,integer,integer,integer,numeric,text,integer,text,numeric,integer,integer,numeric,numeric,numeric,integer,text,jsonb)') is null then
    raise exception 'Autonomous V13 completion function is missing';
  end if;
  if not has_function_privilege('service_role', 'public.complete_autonomous_agent_user_v2(uuid,text,uuid,integer,integer,integer,integer,numeric,text,integer,text,numeric,integer,integer,numeric,numeric,numeric,integer,text,jsonb)', 'EXECUTE') then
    raise exception 'service_role cannot complete Autonomous V13 users';
  end if;
  if not has_function_privilege('service_role', 'public.claim_autonomous_agent_users(integer)', 'EXECUTE') then
    raise exception 'service_role cannot claim cooldown-aware Autonomous Agent users';
  end if;
  if not has_function_privilege('authenticated', 'public.request_autonomous_agent_run()', 'EXECUTE') then
    raise exception 'authenticated users cannot request their own non-paused Autonomous Agent run';
  end if;
end;
$$;

do $$
declare
  missing_columns text[];
begin
  select array_agg(expected.column_name order by expected.column_name)
  into missing_columns
  from (values
    ('autonomous_agent_settings', 'min_data_coverage'),
    ('autonomous_agent_settings', 'max_provider_disagreement'),
    ('autonomous_agent_settings', 'max_drawdown_percent'),
    ('autonomous_agent_settings', 'adaptive_cadence'),
    ('autonomous_agent_state', 'paused_until'),
    ('autonomous_agent_state', 'health_status'),
    ('autonomous_agent_state', 'health_score'),
    ('autonomous_agent_state', 'last_brief'),
    ('autonomous_agent_runs', 'guard_summary'),
    ('autonomous_agent_runs', 'next_check_minutes')
  ) as expected(table_name, column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = expected.table_name
      and c.column_name = expected.column_name
  );

  if missing_columns is not null then
    raise exception 'Autonomous V13 columns are missing: %', array_to_string(missing_columns, ', ');
  end if;
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.autonomous_agent_decision_audit', 'SELECT') then
    raise exception 'Anonymous role can read Autonomous V13 decision audit';
  end if;
  if has_table_privilege('anon', 'public.autonomous_agent_daily_briefs', 'SELECT') then
    raise exception 'Anonymous role can read Autonomous V13 daily briefs';
  end if;
  if has_table_privilege('authenticated', 'public.autonomous_agent_decision_audit', 'INSERT') then
    raise exception 'Authenticated users must not write Autonomous V13 decision audit';
  end if;
  if has_table_privilege('authenticated', 'public.autonomous_agent_daily_briefs', 'UPDATE') then
    raise exception 'Authenticated users must not update Autonomous V13 daily briefs';
  end if;
  if not has_table_privilege('service_role', 'public.autonomous_agent_decision_audit', 'INSERT') then
    raise exception 'service_role cannot write Autonomous V13 decision audit';
  end if;
  if not has_table_privilege('service_role', 'public.autonomous_agent_daily_briefs', 'UPDATE') then
    raise exception 'service_role cannot update Autonomous V13 daily briefs';
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
      and c.relname = 'autonomous_agent_settings'
      and t.tgname = 'autonomous_agent_settings_schedule'
      and not t.tgisinternal
  ) then
    raise exception 'Autonomous V13 settings scheduling trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'autonomous_agent_daily_briefs'
      and t.tgname = 'autonomous_agent_brief_set_updated_at'
      and not t.tgisinternal
  ) then
    raise exception 'Autonomous V13 daily brief updated-at trigger is missing';
  end if;
end;
$$;

select json_build_object(
  'ok', true,
  'version', 'autonomous-v13-schema-verification-v1',
  'paperOnly', true,
  'decisionAuditVerified', true,
  'dailyBriefVerified', true,
  'databaseCooldownVerified', true,
  'serviceRoleWriteVerified', true,
  'authenticatedWriteDenied', true,
  'verifiedAt', now()
) as autonomous_v13_production_schema;
