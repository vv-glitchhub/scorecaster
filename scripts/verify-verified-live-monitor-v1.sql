-- Read-only verification for Scorecaster Verified Live Monitor V1.

with targets as (
  select c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'live_monitor_runs_v1',
      'live_event_snapshots_v1',
      'live_monitor_preferences_v1',
      'live_monitor_alerts_v1'
    )
    and c.relkind in ('r', 'p')
), policies as (
  select tablename, count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('live_monitor_preferences_v1', 'live_monitor_alerts_v1')
  group by tablename
), checks as (
  select
    (select count(*) = 4 from targets) as tables_exist,
    coalesce((select bool_and(relrowsecurity) from targets), false) as rls_enabled,
    coalesce((select bool_and(relforcerowsecurity) from targets), false) as force_rls_enabled,
    not has_table_privilege('anon', 'public.live_monitor_runs_v1', 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon', 'public.live_event_snapshots_v1', 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon', 'public.live_monitor_preferences_v1', 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon', 'public.live_monitor_alerts_v1', 'SELECT,INSERT,UPDATE,DELETE') as anon_blocked,
    not has_table_privilege('authenticated', 'public.live_monitor_runs_v1', 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated', 'public.live_event_snapshots_v1', 'SELECT,INSERT,UPDATE,DELETE') as evidence_service_only,
    has_table_privilege('authenticated', 'public.live_monitor_preferences_v1', 'SELECT,INSERT,UPDATE,DELETE') as preference_access,
    has_table_privilege('authenticated', 'public.live_monitor_alerts_v1', 'SELECT,UPDATE,DELETE')
      and not has_table_privilege('authenticated', 'public.live_monitor_alerts_v1', 'INSERT') as alerts_server_write_only,
    has_table_privilege('service_role', 'public.live_monitor_runs_v1', 'SELECT,INSERT,UPDATE,DELETE')
      and has_table_privilege('service_role', 'public.live_event_snapshots_v1', 'SELECT,INSERT,UPDATE,DELETE')
      and has_table_privilege('service_role', 'public.live_monitor_preferences_v1', 'SELECT,INSERT,UPDATE,DELETE')
      and has_table_privilege('service_role', 'public.live_monitor_alerts_v1', 'SELECT,INSERT,UPDATE,DELETE') as service_access,
    coalesce((select policy_count >= 4 from policies where tablename = 'live_monitor_preferences_v1'), false) as preference_policies,
    coalesce((select policy_count >= 3 from policies where tablename = 'live_monitor_alerts_v1'), false) as alert_policies
)
select json_build_object(
  'ok', tables_exist and rls_enabled and force_rls_enabled and anon_blocked
    and evidence_service_only and preference_access and alerts_server_write_only
    and service_access and preference_policies and alert_policies,
  'version', 'scorecaster-verified-live-monitor-v1',
  'tablesExist', tables_exist,
  'rlsEnabled', rls_enabled,
  'forceRlsEnabled', force_rls_enabled,
  'anonBlocked', anon_blocked,
  'evidenceServiceOnly', evidence_service_only,
  'preferenceUserAccess', preference_access,
  'alertsServerWriteOnly', alerts_server_write_only,
  'serviceRoleAccess', service_access,
  'preferencePolicySet', preference_policies,
  'alertPolicySet', alert_policies,
  'runRows', (select count(*) from public.live_monitor_runs_v1),
  'snapshotRows', (select count(*) from public.live_event_snapshots_v1),
  'preferenceRows', (select count(*) from public.live_monitor_preferences_v1),
  'alertRows', (select count(*) from public.live_monitor_alerts_v1),
  'verifiedAt', now()
) as verified_live_monitor_verification
from checks;
