\set ON_ERROR_STOP on

-- Autonomous Intelligence V12.1 production verification.

do $$
declare missing_tables text[];
begin
  select array_agg(table_name order by table_name) into missing_tables
  from unnest(array['autonomous_agent_models','autonomous_agent_learning_snapshots','autonomous_agent_incidents']) as expected(table_name)
  where to_regclass(format('public.%I', table_name)) is null;
  if missing_tables is not null then raise exception 'Missing Autonomous V12.1 tables: %', array_to_string(missing_tables, ', '); end if;
end;
$$;

do $$
declare insecure_tables text[];
begin
  select array_agg(c.relname order by c.relname) into insecure_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array['autonomous_agent_models','autonomous_agent_learning_snapshots','autonomous_agent_incidents'])
    and (not c.relrowsecurity or not c.relforcerowsecurity);
  if insecure_tables is not null then raise exception 'Autonomous V12.1 forced RLS missing from: %', array_to_string(insecure_tables, ', '); end if;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['autonomous_agent_models','autonomous_agent_learning_snapshots','autonomous_agent_incidents'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name) then
      raise exception 'Autonomous V12.1 policy missing from %', table_name;
    end if;
    if not has_table_privilege('service_role', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'service_role lacks Autonomous V12.1 writes on %', table_name;
    end if;
    if has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') then
      raise exception 'authenticated users must not write Autonomous V12.1 table %', table_name;
    end if;
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT') then
      raise exception 'anon can read Autonomous V12.1 table %', table_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='autonomous_agent_state' and column_name='operating_mode') then raise exception 'V12.1 operating mode missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='autonomous_agent_state' and column_name='kill_switch_active') then raise exception 'V12.1 kill switch missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='autonomous_agent_state' and column_name='next_interval_minutes') then raise exception 'V12.1 adaptive interval missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='autonomous_agent_settings' and column_name='max_drawdown_percent') then raise exception 'V12.1 drawdown setting missing'; end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.autonomous_agent_models
    where probability_applied_to_published_model is distinct from false
       or paper_risk_policy_only is distinct from true
  ) then raise exception 'Unsafe Autonomous V12.1 model registry row'; end if;
end;
$$;

select json_build_object(
  'ok', true,
  'version', 'autonomous-intelligence-v12.1-schema-verification',
  'paperOnly', true,
  'realMoneyBetting', false,
  'forcedRlsVerified', true,
  'serviceRoleWritesVerified', true,
  'authenticatedWritesDenied', true,
  'publishedProbabilityChangesDenied', true,
  'adaptiveControlStateVerified', true,
  'verifiedAt', now()
) as autonomous_v121_schema;
