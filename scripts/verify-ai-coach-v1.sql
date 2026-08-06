-- Read-only verification for Scorecaster AI Coach V1.

with targets as (
  select c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('ai_coach_preferences_v1', 'ai_coach_reports_v1')
    and c.relkind in ('r', 'p')
), policy_counts as (
  select tablename, count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('ai_coach_preferences_v1', 'ai_coach_reports_v1')
  group by tablename
), checks as (
  select
    (select count(*) = 2 from targets) as tables_exist,
    coalesce((select bool_and(relrowsecurity) from targets), false) as rls_enabled,
    coalesce((select bool_and(relforcerowsecurity) from targets), false) as force_rls_enabled,
    not has_table_privilege('anon', 'public.ai_coach_preferences_v1', 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon', 'public.ai_coach_reports_v1', 'SELECT,INSERT,UPDATE,DELETE') as anon_blocked,
    has_table_privilege('authenticated', 'public.ai_coach_preferences_v1', 'SELECT,INSERT,UPDATE,DELETE') as preferences_user_access,
    has_table_privilege('authenticated', 'public.ai_coach_reports_v1', 'SELECT')
      and not has_table_privilege('authenticated', 'public.ai_coach_reports_v1', 'INSERT,UPDATE,DELETE') as reports_read_only,
    has_table_privilege('service_role', 'public.ai_coach_preferences_v1', 'SELECT,INSERT,UPDATE,DELETE')
      and has_table_privilege('service_role', 'public.ai_coach_reports_v1', 'SELECT,INSERT,UPDATE,DELETE') as service_access,
    coalesce((select policy_count >= 4 from policy_counts where tablename = 'ai_coach_preferences_v1'), false) as preferences_policies,
    coalesce((select policy_count >= 1 from policy_counts where tablename = 'ai_coach_reports_v1'), false) as reports_policy
)
select json_build_object(
  'ok', tables_exist and rls_enabled and force_rls_enabled and anon_blocked
    and preferences_user_access and reports_read_only and service_access
    and preferences_policies and reports_policy,
  'version', 'scorecaster-ai-coach-v1',
  'tablesExist', tables_exist,
  'rlsEnabled', rls_enabled,
  'forceRlsEnabled', force_rls_enabled,
  'anonBlocked', anon_blocked,
  'preferencesUserAccess', preferences_user_access,
  'reportsReadOnlyForUser', reports_read_only,
  'serviceRoleAccess', service_access,
  'preferencesPolicySet', preferences_policies,
  'reportsPolicySet', reports_policy,
  'preferenceRows', (select count(*) from public.ai_coach_preferences_v1),
  'reportRows', (select count(*) from public.ai_coach_reports_v1),
  'verifiedAt', now()
) as ai_coach_verification
from checks;
