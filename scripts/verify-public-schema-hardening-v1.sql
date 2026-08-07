-- Read-only verification for Scorecaster public-schema hardening V1.
-- This script changes no schema or data. Any failed invariant raises and stops
-- the production verification run.

-- Every reviewed ordinary/partitioned table must have both RLS and FORCE RLS.
do $$
declare
  insecure_tables text[];
begin
  select array_agg(expected.table_name order by expected.table_name)
  into insecure_tables
  from unnest(array[
    'bankroll_entries','bookmakers','live_player_stats','live_team_stats',
    'match_context','match_context_snapshots','match_model_outputs','matches',
    'model_predictions','odds_cache','odds_market_cache','odds_snapshots',
    'player_game_logs','player_model_stats','player_ratings','player_status',
    'predictions','rating_update_logs','team_game_logs','team_model_stats',
    'team_ratings','team_stats','teams','ai_audit_trail','ai_decisions',
    'ai_intelligence_events','ai_top5','analytics_events','feedback_messages',
    'intelligence_items','intelligence_reports','value_bets','bets',
    'user_settings','community_comments'
  ]) as expected(table_name)
  join pg_class c on c.oid = to_regclass(format('public.%I', expected.table_name))
  where c.relkind in ('r', 'p')
    and (not c.relrowsecurity or not c.relforcerowsecurity);

  if insecure_tables is not null then
    raise exception 'RLS or FORCE RLS is missing from: %', array_to_string(insecure_tables, ', ');
  end if;
end;
$$;

-- No browser role may retain database-owner style privileges anywhere in public.
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

-- PUBLIC must not receive direct table/view privileges. Reviewed public reads are
-- granted to Supabase's anon/authenticated roles and remain subject to RLS.
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

-- Server-internal relations must expose no anon/authenticated privileges. Views
-- are included here even though RLS itself does not apply to them.
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

-- The service role must retain the access required by server APIs and workers.
do $$
declare
  target_relation text;
  target_kind "char";
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
    select c.relkind
      into target_kind
    from pg_class c
    where c.oid = to_regclass(format('public.%I', target_relation));

    if target_kind in ('r', 'p') and not has_table_privilege('service_role', format('public.%I', target_relation), 'SELECT,INSERT,UPDATE,DELETE') then
      missing_access := array_append(missing_access, target_relation || ':CRUD');
    elsif target_kind in ('v', 'm') and not has_table_privilege('service_role', format('public.%I', target_relation), 'SELECT') then
      missing_access := array_append(missing_access, target_relation || ':SELECT');
    end if;
  end loop;

  if cardinality(missing_access) > 0 then
    raise exception 'service_role access is incomplete: %', array_to_string(missing_access, ', ');
  end if;
end;
$$;

-- Reviewed client-facing relations must have the exact grant matrix and policy
-- backing expected by the hardening migration.
do $$
declare
  required_command text;
begin
  if to_regclass('public.bets') is not null then
    if has_table_privilege('anon', 'public.bets', 'SELECT') then
      raise exception 'anon must not read bets';
    end if;
    if not has_table_privilege('authenticated', 'public.bets', 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'authenticated bets CRUD grant matrix is incomplete';
    end if;

    foreach required_command in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if not exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'bets'
          and upper(p.cmd) in ('ALL', required_command)
          and exists (
            select 1 from unnest(p.roles) as policy_role
            where policy_role::text in ('authenticated', 'public')
          )
      ) then
        raise exception 'bets grant lacks RLS policy backing for %', required_command;
      end if;
    end loop;
  end if;

  if to_regclass('public.user_settings') is not null then
    if has_table_privilege('anon', 'public.user_settings', 'SELECT') then
      raise exception 'anon must not read user_settings';
    end if;
    if not has_table_privilege('authenticated', 'public.user_settings', 'SELECT,INSERT,UPDATE') then
      raise exception 'authenticated user_settings grant matrix is incomplete';
    end if;
    if has_table_privilege('authenticated', 'public.user_settings', 'DELETE') then
      raise exception 'authenticated must not delete user_settings directly';
    end if;

    foreach required_command in array array['SELECT', 'INSERT', 'UPDATE']
    loop
      if not exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'user_settings'
          and upper(p.cmd) in ('ALL', required_command)
          and exists (
            select 1 from unnest(p.roles) as policy_role
            where policy_role::text in ('authenticated', 'public')
          )
      ) then
        raise exception 'user_settings grant lacks RLS policy backing for %', required_command;
      end if;
    end loop;
  end if;

  if to_regclass('public.community_comments') is not null then
    if not has_table_privilege('anon', 'public.community_comments', 'SELECT') then
      raise exception 'anon community comment read is missing';
    end if;
    if has_table_privilege('anon', 'public.community_comments', 'INSERT,UPDATE,DELETE') then
      raise exception 'anon must not mutate community comments';
    end if;
    if not has_table_privilege('authenticated', 'public.community_comments', 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'authenticated community comment grant matrix is incomplete';
    end if;

    foreach required_command in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if not exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'community_comments'
          and upper(p.cmd) in ('ALL', required_command)
          and exists (
            select 1 from unnest(p.roles) as policy_role
            where policy_role::text in (
              case when required_command = 'SELECT' then 'public' else 'authenticated' end,
              'public'
            )
          )
      ) then
        raise exception 'community_comments grant lacks RLS policy backing for %', required_command;
      end if;
    end loop;
  end if;
end;
$$;

select json_build_object(
  'ok', true,
  'version', 'public-schema-hardening-v1.2',
  'rlsEnabledForTables', true,
  'viewsProtectedByGrantRevocation', true,
  'forceRlsEnabled', true,
  'dangerousClientGrants', 0,
  'publicTableGrants', 0,
  'internalClientExposure', 0,
  'reviewedClientGrantsPolicyBacked', true,
  'serverAccess', 'service_role',
  'paperOnly', true,
  'verifiedAt', now()
) as scorecaster_public_schema_hardening;
