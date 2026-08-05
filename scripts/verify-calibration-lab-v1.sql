-- Read-only verification for Scorecaster CLV and Calibration Lab V1.

with targets as (
  select c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('calibration_observations_v1', 'calibration_settlement_runs_v1')
    and c.relkind in ('r', 'p')
), privileges as (
  select
    bool_or(
      has_table_privilege('anon', format('public.%I', relname), 'SELECT')
      or has_table_privilege('anon', format('public.%I', relname), 'INSERT')
      or has_table_privilege('anon', format('public.%I', relname), 'UPDATE')
      or has_table_privilege('anon', format('public.%I', relname), 'DELETE')
    ) as anon_access,
    bool_or(
      has_table_privilege('authenticated', format('public.%I', relname), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', relname), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', relname), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', relname), 'DELETE')
    ) as authenticated_access,
    bool_and(
      has_table_privilege('service_role', format('public.%I', relname), 'SELECT')
      and has_table_privilege('service_role', format('public.%I', relname), 'INSERT')
      and has_table_privilege('service_role', format('public.%I', relname), 'UPDATE')
      and has_table_privilege('service_role', format('public.%I', relname), 'DELETE')
    ) as service_access
  from targets
)
select json_build_object(
  'ok',
    (select count(*) = 2 from targets)
    and coalesce((select bool_and(relrowsecurity) from targets), false)
    and coalesce((select bool_and(relforcerowsecurity) from targets), false)
    and not coalesce((select anon_access from privileges), true)
    and not coalesce((select authenticated_access from privileges), true)
    and coalesce((select service_access from privileges), false),
  'version', 'calibration-lab-v1',
  'tablesExist', (select count(*) = 2 from targets),
  'rlsEnabled', coalesce((select bool_and(relrowsecurity) from targets), false),
  'forceRlsEnabled', coalesce((select bool_and(relforcerowsecurity) from targets), false),
  'anonDirectAccess', coalesce((select anon_access from privileges), true),
  'authenticatedDirectAccess', coalesce((select authenticated_access from privileges), true),
  'serviceRoleAccess', coalesce((select service_access from privileges), false),
  'observationCount', (select count(*) from public.calibration_observations_v1),
  'eligibleCount', (select count(*) from public.calibration_observations_v1 where exclusion_reason is null),
  'exclusionCount', (select count(*) from public.calibration_observations_v1 where exclusion_reason is not null),
  'runCount', (select count(*) from public.calibration_settlement_runs_v1),
  'verifiedAt', now()
) as calibration_lab_verification;
