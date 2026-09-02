-- Read-only verification for Scorecaster public-schema hardening V1.5.
-- This script changes no schema or data. Any failed invariant raises and stops
-- the production verification run.

-- Every public ordinary/partitioned table must keep RLS + FORCE RLS.
do $$
declare
  insecure_tables text[];
begin
  select array_agg(c.relname order by c.relname)
  into insecure_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (not c.relrowsecurity or not c.relforcerowsecurity);

  if insecure_tables is not null then
    raise exception 'RLS or FORCE RLS is missing from: %', array_to_string(insecure_tables, ', ');
  end if;
end;
$$;

-- Browser roles never need database-owner style table privileges.
do $$
declare
  dangerous_grants text[];
begin
  select array_agg(format('%s:%s:%s', table_name, grantee, privilege_type) order by table_name, grantee, privilege_type)
  into dangerous_grants
  from information_schema.table_privileges
  where table_schema = 'public'
    and grantee in ('PUBLIC', 'anon', 'authenticated')
    and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');

  if dangerous_grants is not null then
    raise exception 'Dangerous client grants remain: %', array_to_string(dangerous_grants, ', ');
  end if;
end;
$$;

-- PUBLIC itself receives no direct table/view privileges.
do $$
declare
  public_grants text[];
begin
  select array_agg(format('%s:%s', table_name, privilege_type) order by table_name, privilege_type)
  into public_grants
  from information_schema.table_privileges
  where table_schema = 'public'
    and grantee = 'PUBLIC';

  if public_grants is not null then
    raise exception 'PUBLIC table privileges remain: %', array_to_string(public_grants, ', ');
  end if;
end;
$$;

-- A table with RLS enabled but no policy is server-internal by construction and
-- must expose zero direct browser privileges.
do $$
declare
  exposed text[];
begin
  select array_agg(format('%s:%s:%s', c.relname, tp.grantee, tp.privilege_type) order by c.relname, tp.grantee, tp.privilege_type)
  into exposed
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join information_schema.table_privileges tp
    on tp.table_schema = n.nspname and tp.table_name = c.relname
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity
    and tp.grantee in ('anon', 'authenticated')
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname
    );

  if exposed is not null then
    raise exception 'Policyless RLS tables still expose client privileges: %', array_to_string(exposed, ', ');
  end if;
end;
$$;

-- Reviewed Scorecaster internal relations expose no browser privileges. Views are
-- included even though RLS itself does not apply to them.
do $$
declare
  internal_exposure text[];
begin
  select array_agg(format('%s:%s:%s', p.table_name, p.grantee, p.privilege_type) order by p.table_name, p.grantee, p.privilege_type)
  into internal_exposure
  from information_schema.table_privileges p
  where p.table_schema = 'public'
    and p.grantee in ('anon', 'authenticated')
    and p.table_name = any(array[
      'bankroll_entries','bookmakers','live_player_stats','live_team_stats',
      'match_context','match_context_snapshots','match_model_outputs','matches',
      'model_predictions','odds_cache','odds_market_cache','odds_snapshots',
      'player_game_logs','player_model_stats','player_ratings','player_status',
      'predictions','rating_update_logs','team_game_logs','team_model_stats',
      'team_ratings','team_stats','teams','ai_audit_trail','ai_decisions',
      'ai_intelligence_events','ai_top5','analytics_events','feedback_messages',
      'intelligence_items','intelligence_reports','value_bets'
    ]);

  if internal_exposure is not null then
    raise exception 'Internal relations still expose client privileges: %', array_to_string(internal_exposure, ', ');
  end if;
end;
$$;

-- The service role must retain reviewed access to internal relations.
do $$
declare
  target_relation text;
  target_kind "char";
  required_command text;
  missing_access text[] := array[]::text[];
begin
  foreach target_relation in array array[
    'bankroll_entries','bookmakers','live_player_stats','live_team_stats',
    'match_context','match_context_snapshots','match_model_outputs','matches',
    'model_predictions','odds_cache','odds_market_cache','odds_snapshots',
    'player_game_logs','player_model_stats','player_ratings','player_status',
    'predictions','rating_update_logs','team_game_logs','team_model_stats',
    'team_ratings','team_stats','teams','ai_audit_trail','ai_decisions',
    'ai_intelligence_events','ai_top5','analytics_events','feedback_messages',
    'intelligence_items','intelligence_reports','value_bets'
  ]
  loop
    select c.relkind into target_kind
    from pg_class c
    where c.oid = to_regclass(format('public.%I', target_relation));

    if target_kind in ('r', 'p') then
      foreach required_command in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
      loop
        if not has_table_privilege('service_role', format('public.%I', target_relation), required_command) then
          missing_access := array_append(missing_access, target_relation || ':' || required_command);
        end if;
      end loop;
    elsif target_kind in ('v', 'm') then
      if not has_table_privilege('service_role', format('public.%I', target_relation), 'SELECT') then
        missing_access := array_append(missing_access, target_relation || ':SELECT');
      end if;
    end if;
  end loop;

  if cardinality(missing_access) > 0 then
    raise exception 'service_role access is incomplete: %', array_to_string(missing_access, ', ');
  end if;
end;
$$;

-- Profiles: authenticated SELECT + UPDATE only, anon closed, and the obsolete
-- direct-client INSERT policy must be absent.
do $$
begin
  if to_regclass('public.profiles') is not null then
    if has_table_privilege('anon', 'public.profiles', 'SELECT')
      or has_table_privilege('anon', 'public.profiles', 'INSERT')
      or has_table_privilege('anon', 'public.profiles', 'UPDATE')
      or has_table_privilege('anon', 'public.profiles', 'DELETE') then
      raise exception 'anon must not access profiles';
    end if;
    if not has_table_privilege('authenticated', 'public.profiles', 'SELECT')
      or not has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
      raise exception 'authenticated profiles SELECT/UPDATE grant is incomplete';
    end if;
    if has_table_privilege('authenticated', 'public.profiles', 'INSERT')
      or has_table_privilege('authenticated', 'public.profiles', 'DELETE') then
      raise exception 'authenticated profiles must not allow direct INSERT/DELETE';
    end if;
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles'
        and policyname = 'Users insert own profile'
    ) then
      raise exception 'legacy Users insert own profile policy remains';
    end if;
  end if;
end;
$$;

-- Legacy user-owned cloud rows are authenticated CRUD surfaces only. Their
-- restored grants must be backed by an authenticated RLS policy.
do $$
declare
  target_relation text;
  required_command text;
begin
  foreach target_relation in array array[
    'bet_slips','bet_slip_items','tracked_bets',
    'pick_explanations','agent_feedback','risk_events'
  ]
  loop
    if to_regclass(format('public.%I', target_relation)) is null then continue; end if;

    foreach required_command in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if has_table_privilege('anon', format('public.%I', target_relation), required_command) then
        raise exception 'anon must not access % with %', target_relation, required_command;
      end if;
      if not has_table_privilege('authenticated', format('public.%I', target_relation), required_command) then
        raise exception 'authenticated % grant is missing %', target_relation, required_command;
      end if;
      if not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = target_relation
          and upper(p.cmd) in ('ALL', required_command)
          and exists (
            select 1 from unnest(p.roles) as policy_role
            where policy_role::text in ('authenticated', 'public')
          )
      ) then
        raise exception '% grant lacks RLS policy backing for %', target_relation, required_command;
      end if;
    end loop;
  end loop;
end;
$$;

-- Current reviewed client matrices.
do $$
declare
  required_command text;
begin
  if to_regclass('public.bets') is not null then
    if has_table_privilege('anon', 'public.bets', 'SELECT') then raise exception 'anon must not read bets'; end if;
    foreach required_command in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if not has_table_privilege('authenticated', 'public.bets', required_command) then
        raise exception 'authenticated bets grant is missing %', required_command;
      end if;
      if not exists (
        select 1 from pg_policies p
        where p.schemaname='public' and p.tablename='bets'
          and upper(p.cmd) in ('ALL', required_command)
          and exists (select 1 from unnest(p.roles) r where r::text in ('authenticated','public'))
      ) then raise exception 'bets grant lacks RLS policy backing for %', required_command; end if;
    end loop;
  end if;

  if to_regclass('public.user_settings') is not null then
    if has_table_privilege('anon', 'public.user_settings', 'SELECT') then raise exception 'anon must not read user_settings'; end if;
    if has_table_privilege('authenticated', 'public.user_settings', 'DELETE') then raise exception 'authenticated must not delete user_settings directly'; end if;
    foreach required_command in array array['SELECT', 'INSERT', 'UPDATE']
    loop
      if not has_table_privilege('authenticated', 'public.user_settings', required_command) then
        raise exception 'authenticated user_settings grant is missing %', required_command;
      end if;
    end loop;
  end if;

  if to_regclass('public.community_comments') is not null then
    if not has_table_privilege('anon', 'public.community_comments', 'SELECT') then raise exception 'anon community comment read is missing'; end if;
    foreach required_command in array array['INSERT', 'UPDATE', 'DELETE']
    loop
      if has_table_privilege('anon', 'public.community_comments', required_command) then
        raise exception 'anon must not mutate community comments with %', required_command;
      end if;
    end loop;
    foreach required_command in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if not has_table_privilege('authenticated', 'public.community_comments', required_command) then
        raise exception 'authenticated community comment grant is missing %', required_command;
      end if;
    end loop;
  end if;
end;
$$;

-- Public SECURITY DEFINER execution is service_role-only. Authenticated users
-- call four SECURITY INVOKER wrappers whose privileged implementations live in
-- the unexposed scorecaster_private schema. API quota mutation stays server-only.
do $$
declare
  anon_exposure text[];
  authenticated_exposure text[];
  missing_service text[];
  expected_rpc text;
  expected_impl text;
  rpc regprocedure;
  quota_rpc regprocedure;
begin
  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
  into anon_exposure
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  if anon_exposure is not null then
    raise exception 'Anonymous SECURITY DEFINER execution remains: %', array_to_string(anon_exposure, ', ');
  end if;

  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
  into authenticated_exposure
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if authenticated_exposure is not null then
    raise exception 'Authenticated SECURITY DEFINER execution remains: %', array_to_string(authenticated_exposure, ', ');
  end if;

  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
  into missing_service
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not has_function_privilege('service_role', p.oid, 'EXECUTE');
  if missing_service is not null then
    raise exception 'service_role SECURITY DEFINER execution is incomplete: %', array_to_string(missing_service, ', ');
  end if;

  foreach expected_rpc in array array[
    'public.claim_notification_device(text,text,text,text)',
    'public.request_autonomous_agent_run()',
    'public.set_auto_watch_recommendation_preferences(boolean,integer,numeric,integer)',
    'public.set_auto_watch_recommendation_preferences_v2(boolean,integer,numeric,integer,text,numeric,numeric,numeric,text[])'
  ]
  loop
    rpc := to_regprocedure(expected_rpc);
    if rpc is null then
      raise exception 'Required authenticated RPC is missing: %', expected_rpc;
    end if;
    if (select p.prosecdef from pg_proc p where p.oid = rpc) then
      raise exception 'Authenticated RPC must be SECURITY INVOKER: %', expected_rpc;
    end if;
    if not has_function_privilege('authenticated', rpc, 'EXECUTE') then
      raise exception 'Required authenticated RPC EXECUTE is missing: %', expected_rpc;
    end if;
    if has_function_privilege('anon', rpc, 'EXECUTE') then
      raise exception 'Anonymous user can execute authenticated RPC: %', expected_rpc;
    end if;
  end loop;

  if not has_schema_privilege('authenticated', 'scorecaster_private', 'USAGE') then
    raise exception 'Authenticated wrapper execution cannot reach scorecaster_private';
  end if;
  foreach expected_impl in array array[
    'scorecaster_private.claim_notification_device_impl(text,text,text,text)',
    'scorecaster_private.request_autonomous_agent_run_impl()',
    'scorecaster_private.set_auto_watch_recommendation_preferences_impl(boolean,integer,numeric,integer)',
    'scorecaster_private.set_auto_watch_recommendation_preferences_v2_impl(boolean,integer,numeric,integer,text,numeric,numeric,numeric,text[])'
  ]
  loop
    rpc := to_regprocedure(expected_impl);
    if rpc is null then
      raise exception 'Required private RPC implementation is missing: %', expected_impl;
    end if;
    if not (select p.prosecdef from pg_proc p where p.oid = rpc) then
      raise exception 'Private RPC implementation must be SECURITY DEFINER: %', expected_impl;
    end if;
    if not has_function_privilege('authenticated', rpc, 'EXECUTE') then
      raise exception 'Authenticated wrapper cannot execute private implementation: %', expected_impl;
    end if;
    if has_function_privilege('anon', rpc, 'EXECUTE') then
      raise exception 'Anonymous user can execute private RPC implementation: %', expected_impl;
    end if;
  end loop;

  if to_regprocedure('public.consume_api_quota(text,integer,integer)') is not null then
    raise exception 'Legacy authenticated quota RPC still exists';
  end if;

  quota_rpc := to_regprocedure('public.consume_api_quota_for_user(uuid,text,integer,integer)');
  if quota_rpc is null then
    raise exception 'Server-owned quota RPC is missing';
  end if;
  if has_function_privilege('authenticated', quota_rpc, 'EXECUTE') then
    raise exception 'Authenticated users can execute server-owned quota RPC';
  end if;
  if not has_function_privilege('service_role', quota_rpc, 'EXECUTE') then
    raise exception 'service_role quota RPC execution is missing';
  end if;
end;
$$;

select json_build_object(
  'ok', true,
  'version', 'public-schema-hardening-v1.5',
  'rlsEnabledForTables', true,
  'viewsProtectedByGrantRevocation', true,
  'forceRlsEnabled', true,
  'dangerousClientGrants', 0,
  'publicTableGrants', 0,
  'policylessClientExposure', 0,
  'internalClientExposure', 0,
  'profilesClientMatrix', 'authenticated:select+update',
  'legacyUserOwnedClientMatrix', 'authenticated:crud',
  'reviewedClientGrantsPolicyBacked', true,
  'securityDefinerAnonExecute', 0,
  'securityDefinerAuthenticatedExecute', 0,
  'authenticatedInvokerRpcs', json_build_array(
    'claim_notification_device(text,text,text,text)',
    'request_autonomous_agent_run()',
    'set_auto_watch_recommendation_preferences(boolean,integer,numeric,integer)',
    'set_auto_watch_recommendation_preferences_v2(boolean,integer,numeric,integer,text,numeric,numeric,numeric,text[])'
  ),
  'apiQuotaMutation', 'service_role-only',
  'serverAccess', 'service_role',
  'paperOnly', true,
  'verifiedAt', now()
) as scorecaster_public_schema_hardening;
