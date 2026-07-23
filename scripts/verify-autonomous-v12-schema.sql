\set ON_ERROR_STOP on

-- Scorecaster Autonomous Intelligence V12 production verification.
-- Read-only checks. Any failed assertion aborts production activation.

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
    'autonomous_agent_models',
    'autonomous_agent_learning_snapshots',
    'autonomous_agent_incidents'
  ]) as expected(table_name)
  where to_regclass(format('public.%I', table_name)) is null;

  if missing_tables is not null then
    raise exception 'Missing Autonomous Intelligence V12 tables: %', array_to_string(missing_tables, ', ');
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
      'autonomous_agent_models',
      'autonomous_agent_learning_snapshots',
      'autonomous_agent_incidents'
    ])
    and (not c.relrowsecurity or not c.relforcerowsecurity);

  if insecure_tables is not null then
    raise exception 'Autonomous V12 RLS or FORCE RLS is missing from: %', array_to_string(insecure_tables, ', ');
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
    'autonomous_agent_models',
    'autonomous_agent_learning_snapshots',
    'autonomous_agent_incidents'
  ]) as expected(table_name)
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = expected.table_name
  );

  if tables_without_policies is not null then
    raise exception 'Autonomous V12 RLS policies are missing from: %', array_to_string(tables_without_policies, ', ');
  end if;
end;
$$;

do $$
begin
  if to_regprocedure('public.complete_autonomous_agent_user_v12(uuid,text,uuid,integer,integer,integer,integer,numeric,text,text,numeric,boolean,text,integer,text,text,integer)') is null then
    raise exception 'Autonomous Intelligence V12 completion function is missing';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.complete_autonomous_agent_user_v12(uuid,text,uuid,integer,integer,integer,integer,numeric,text,text,numeric,boolean,text,integer,text,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot complete Autonomous Intelligence V12 users';
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'autonomous_agent_models',
    'autonomous_agent_learning_snapshots',
    'autonomous_agent_incidents'
  ] loop
    if not has_table_privilege('service_role', format('public.%I', table_name), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', table_name), 'INSERT')
       or not has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE')
       or not has_table_privilege('service_role', format('public.%I', table_name), 'DELETE') then
      raise exception 'service_role lacks full Autonomous V12 access on %', table_name;
    end if;

    if has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') then
      raise exception 'authenticated users must not write Autonomous V12 table %', table_name;
    end if;

    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT') then
      raise exception 'Anonymous role can read Autonomous V12 table %', table_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'autonomous_agent_models'
      and column_name = 'probability_applied_to_published_model'
  ) then
    raise exception 'Autonomous model published-probability safety column is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'autonomous_agent_models'
      and column_name = 'paper_risk_policy_only'
  ) then
    raise exception 'Autonomous model paper-risk-only safety column is missing';
  end if;

  if exists (
    select 1
    from public.autonomous_agent_models
    where probability_applied_to_published_model is distinct from false
       or paper_risk_policy_only is distinct from true
  ) then
    raise exception 'Autonomous V12 model registry contains an unsafe production-probability model';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'autonomous_agent_state' and column_name = 'operating_mode'
  ) then raise exception 'Autonomous V12 operating mode state is missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'autonomous_agent_state' and column_name = 'kill_switch_active'
  ) then raise exception 'Autonomous V12 kill switch state is missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'autonomous_agent_state' and column_name = 'next_interval_minutes'
  ) then raise exception 'Autonomous V12 adaptive interval state is missing'; end if;
end;
$$;

select json_build_object(
  'ok', true,
  'version', 'autonomous-intelligence-v12-schema-verification',
  'paperOnly', true,
  'realMoneyBetting', false,
  'forcedRlsVerified', true,
  'serviceRoleWritesVerified', true,
  'authenticatedWritesDenied', true,
  'publishedProbabilityChangesDenied', true,
  'adaptiveControlStateVerified', true,
  'verifiedAt', now()
) as autonomous_v12_schema;
