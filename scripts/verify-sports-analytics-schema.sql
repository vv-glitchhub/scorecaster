\set ON_ERROR_STOP on

-- Scorecaster Sports Analytics Production Verification V1
-- Read-only assertions for shared non-personal analytics storage.

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
    'sports_analytics_snapshots',
    'sports_analytics_observations'
  ]) as expected(table_name)
  where to_regclass(format('public.%I', table_name)) is null;

  if missing_tables is not null then
    raise exception 'Missing Sports Analytics tables: %', array_to_string(missing_tables, ', ');
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
    and c.relname = any(array['sports_analytics_snapshots', 'sports_analytics_observations'])
    and (not c.relrowsecurity or not c.relforcerowsecurity);

  if insecure_tables is not null then
    raise exception 'Sports Analytics RLS or FORCE RLS is missing from: %', array_to_string(insecure_tables, ', ');
  end if;
end;
$$;

do $$
begin
  if not has_table_privilege('service_role', 'public.sports_analytics_snapshots', 'INSERT') then
    raise exception 'service_role cannot insert Sports Analytics snapshots';
  end if;
  if not has_table_privilege('service_role', 'public.sports_analytics_snapshots', 'SELECT') then
    raise exception 'service_role cannot read Sports Analytics snapshots';
  end if;
  if not has_table_privilege('service_role', 'public.sports_analytics_observations', 'INSERT') then
    raise exception 'service_role cannot insert Sports Analytics observations';
  end if;
  if not has_table_privilege('service_role', 'public.sports_analytics_observations', 'SELECT') then
    raise exception 'service_role cannot read Sports Analytics observations';
  end if;

  if has_table_privilege('anon', 'public.sports_analytics_snapshots', 'SELECT')
     or has_table_privilege('anon', 'public.sports_analytics_observations', 'SELECT') then
    raise exception 'anon must not read Sports Analytics storage directly';
  end if;
  if has_table_privilege('authenticated', 'public.sports_analytics_snapshots', 'SELECT')
     or has_table_privilege('authenticated', 'public.sports_analytics_observations', 'SELECT') then
    raise exception 'authenticated clients must use the sanitized Sports Analytics API';
  end if;
  if has_table_privilege('authenticated', 'public.sports_analytics_snapshots', 'INSERT')
     or has_table_privilege('authenticated', 'public.sports_analytics_observations', 'INSERT') then
    raise exception 'authenticated clients must not write Sports Analytics storage';
  end if;
end;
$$;

do $$
declare
  unsafe_snapshots integer;
  unsafe_observations integer;
begin
  select count(*) into unsafe_snapshots
  from public.sports_analytics_snapshots
  where paper_only is not true;

  select count(*) into unsafe_observations
  from public.sports_analytics_observations
  where paper_only is not true
     or source_trust < 0 or source_trust > 1
     or confidence < 0 or confidence > 1;

  if unsafe_snapshots > 0 or unsafe_observations > 0 then
    raise exception 'Sports Analytics contains rows outside the paper-only or bounded-quality contract';
  end if;
end;
$$;

select json_build_object(
  'ok', true,
  'version', 'sports-analytics-schema-verification-v1',
  'tablesVerified', true,
  'forcedRlsVerified', true,
  'serviceRoleVerified', true,
  'directClientAccessDisabled', true,
  'paperOnly', true,
  'verifiedAt', now()
) as scorecaster_sports_analytics_schema;
