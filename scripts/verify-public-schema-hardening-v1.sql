-- Read-only verification for Scorecaster public-schema hardening V1.

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
  where not c.relrowsecurity or not c.relforcerowsecurity;

  if insecure_tables is not null then
    raise exception 'RLS or FORCE RLS is missing from: %', array_to_string(insecure_tables, ', ');
  end if;
end;
$$;

do $$
declare
  dangerous_grants text[];
begin
  select array_agg(format('%s:%s:%s', table_name, grantee, privilege_type) order by table_name, grantee, privilege_type)
  into dangerous_grants
  from information_schema.table_privileges
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');

  if dangerous_grants is not null then
    raise exception 'Dangerous client grants remain: %', array_to_string(dangerous_grants, ', ');
  end if;
end;
$$;

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
    raise exception 'Internal tables still expose client privileges: %', array_to_string(internal_exposure, ', ');
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.bets') is not null then
    if has_table_privilege('anon', 'public.bets', 'SELECT') then
      raise exception 'anon must not read bets';
    end if;
    if not has_table_privilege('authenticated', 'public.bets', 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'authenticated bets CRUD grant matrix is incomplete';
    end if;
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
  end if;

  if to_regclass('public.community_comments') is not null then
    if not has_table_privilege('anon', 'public.community_comments', 'SELECT') then
      raise exception 'anon community comment read is missing';
    end if;
    if has_table_privilege('anon', 'public.community_comments', 'INSERT') then
      raise exception 'anon must not create community comments';
    end if;
    if not has_table_privilege('authenticated', 'public.community_comments', 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'authenticated community comment grant matrix is incomplete';
    end if;
  end if;
end;
$$;

select json_build_object(
  'ok', true,
  'version', 'public-schema-hardening-v1',
  'rlsEnabled', true,
  'forceRlsEnabled', true,
  'dangerousClientGrants', 0,
  'internalClientExposure', 0,
  'serverAccess', 'service_role',
  'paperOnly', true,
  'verifiedAt', now()
) as scorecaster_public_schema_hardening;
