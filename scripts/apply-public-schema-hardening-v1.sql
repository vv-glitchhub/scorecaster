-- Scorecaster public-schema hardening V1.5
-- Idempotent, data-preserving production patch derived from the live 2026-08-09
-- Supabase grant/function audit. It does not drop tables, columns, rows or RLS
-- policies except the obsolete direct-client profile INSERT policy.
--
-- Browser roles are narrowed to reviewed CRUD/RPC surfaces. Server workers keep
-- service_role access. Missing policy support fails the complete transaction.

begin;

-- PUBLIC never needs direct relation privileges in the exposed public schema.
revoke all privileges on all tables in schema public from public;

-- Remove database-owner style relation privileges from every browser-facing
-- table. PostgREST CRUD never requires TRUNCATE, TRIGGER or REFERENCES.
do $$
declare
  target record;
begin
  for target in
    select n.nspname as schema_name, c.relname as relation_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format(
      'revoke truncate, references, trigger on table %I.%I from anon, authenticated',
      target.schema_name,
      target.relation_name
    );
  end loop;
end;
$$;

-- Any RLS table without policies is server-internal by construction: no browser
-- role can obtain rows from it. Remove its direct browser grants entirely and
-- preserve service_role for server APIs/workers.
do $$
declare
  target record;
begin
  for target in
    select c.relname as relation_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = c.relname
      )
  loop
    execute format('alter table public.%I force row level security', target.relation_name);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', target.relation_name);
    execute format('grant all privileges on table public.%I to service_role', target.relation_name);
  end loop;
end;
$$;

-- Reviewed server-internal and legacy data surfaces. Ordinary tables receive
-- RLS + FORCE RLS; views/materialized views are protected by grant revocation.
do $$
declare
  target_relation text;
  target_kind "char";
begin
  foreach target_relation in array array[
    'bankroll_entries',
    'bookmakers',
    'live_player_stats',
    'live_team_stats',
    'match_context',
    'match_context_snapshots',
    'match_model_outputs',
    'matches',
    'model_predictions',
    'odds_cache',
    'odds_market_cache',
    'odds_snapshots',
    'player_game_logs',
    'player_model_stats',
    'player_ratings',
    'player_status',
    'predictions',
    'rating_update_logs',
    'team_game_logs',
    'team_model_stats',
    'team_ratings',
    'team_stats',
    'teams',
    'ai_audit_trail',
    'ai_decisions',
    'ai_intelligence_events',
    'ai_top5',
    'analytics_events',
    'feedback_messages',
    'intelligence_items',
    'intelligence_reports',
    'value_bets'
  ]
  loop
    select c.relkind
      into target_kind
    from pg_class c
    where c.oid = to_regclass(format('public.%I', target_relation));

    if target_kind in ('r', 'p') then
      execute format('alter table public.%I enable row level security', target_relation);
      execute format('alter table public.%I force row level security', target_relation);
      execute format('revoke all privileges on table public.%I from public, anon, authenticated', target_relation);
      execute format('grant all privileges on table public.%I to service_role', target_relation);
    elsif target_kind in ('v', 'm') then
      execute format('revoke all privileges on table public.%I from public, anon, authenticated', target_relation);
      execute format('grant select on table public.%I to service_role', target_relation);
    elsif target_kind is not null then
      raise exception 'Unsupported relation kind % for public.%', target_kind, target_relation;
    end if;
  end loop;
end;
$$;

-- Legacy Production MVP user-owned rows remain authenticated CRUD surfaces.
-- Anonymous access is removed and every restored CRUD command must be backed by
-- the existing authenticated RLS policy.
do $$
declare
  target_relation text;
  required_command text;
begin
  foreach target_relation in array array[
    'bet_slips',
    'bet_slip_items',
    'tracked_bets',
    'pick_explanations',
    'agent_feedback',
    'risk_events'
  ]
  loop
    if to_regclass(format('public.%I', target_relation)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', target_relation);
    execute format('alter table public.%I force row level security', target_relation);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', target_relation);

    foreach required_command in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if not exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = target_relation
          and upper(p.cmd) in ('ALL', required_command)
          and exists (
            select 1 from unnest(p.roles) as policy_role
            where policy_role::text in ('authenticated', 'public')
          )
      ) then
        raise exception 'Public schema hardening refused: % lacks authenticated RLS policy backing for %', target_relation, required_command;
      end if;
    end loop;

    execute format('grant select, insert, update, delete on table public.%I to authenticated', target_relation);
    execute format('grant all privileges on table public.%I to service_role', target_relation);
  end loop;
end;
$$;

-- Profiles are database/server-created by auth.users trigger. Direct clients may
-- only read/update their own row; INSERT and DELETE stay server-owned.
do $$
declare
  required_command text;
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;
    alter table public.profiles force row level security;
    drop policy if exists "Users insert own profile" on public.profiles;
    revoke all privileges on table public.profiles from public, anon, authenticated;

    foreach required_command in array array['SELECT', 'UPDATE']
    loop
      if not exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'profiles'
          and upper(p.cmd) in ('ALL', required_command)
          and exists (
            select 1 from unnest(p.roles) as policy_role
            where policy_role::text in ('authenticated', 'public')
          )
      ) then
        raise exception 'Public schema hardening refused: profiles lacks authenticated RLS policy backing for %', required_command;
      end if;
    end loop;

    grant select, update on table public.profiles to authenticated;
    grant all privileges on table public.profiles to service_role;
  end if;
end;
$$;

-- Current paper bets remain authenticated CRUD, policy-backed and anon-closed.
do $$
declare
  required_command text;
begin
  if to_regclass('public.bets') is not null then
    alter table public.bets enable row level security;
    alter table public.bets force row level security;
    revoke all privileges on table public.bets from public, anon, authenticated;

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
        raise exception 'Public schema hardening refused: bets lacks authenticated RLS policy backing for %', required_command;
      end if;
    end loop;

    grant select, insert, update, delete on table public.bets to authenticated;
    grant all privileges on table public.bets to service_role;
  end if;
end;
$$;

-- User settings keep SELECT/INSERT/UPDATE only; direct DELETE stays revoked.
do $$
declare
  required_command text;
begin
  if to_regclass('public.user_settings') is not null then
    alter table public.user_settings enable row level security;
    alter table public.user_settings force row level security;
    revoke all privileges on table public.user_settings from public, anon, authenticated;

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
        raise exception 'Public schema hardening refused: user_settings lacks authenticated RLS policy backing for %', required_command;
      end if;
    end loop;

    grant select, insert, update on table public.user_settings to authenticated;
    grant all privileges on table public.user_settings to service_role;
  end if;
end;
$$;

-- Community Feed remains publicly readable, while writes require authentication.
do $$
declare
  required_command text;
  required_role text;
begin
  if to_regclass('public.community_comments') is not null then
    alter table public.community_comments enable row level security;
    alter table public.community_comments force row level security;
    revoke all privileges on table public.community_comments from public, anon, authenticated;

    foreach required_command in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      required_role := case when required_command = 'SELECT' then 'public' else 'authenticated' end;
      if not exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = 'community_comments'
          and upper(p.cmd) in ('ALL', required_command)
          and exists (
            select 1 from unnest(p.roles) as policy_role
            where policy_role::text in (required_role, 'public')
          )
      ) then
        raise exception 'Public schema hardening refused: community_comments lacks % RLS policy backing for %', required_role, required_command;
      end if;
    end loop;

    grant select on table public.community_comments to anon, authenticated;
    grant insert, update, delete on table public.community_comments to authenticated;
    grant all privileges on table public.community_comments to service_role;
  end if;
end;
$$;

-- SECURITY DEFINER functions are privileged server boundaries. Revoke inherited
-- PUBLIC/browser execution from every current public function and keep those
-- public privileged functions service-role-only. User-facing RPCs are separate
-- SECURITY INVOKER wrappers installed by authenticated RPC boundaries V1.
do $$
declare
  target record;
begin
  for target in
    select p.oid, p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke all privileges on function %s from public, anon, authenticated', target.signature);
    execute format('grant execute on function %s to service_role', target.signature);
  end loop;
end;
$$;

-- Reviewed user-facing RPCs must be non-privileged public wrappers. Their
-- privileged implementations live in the unexposed scorecaster_private schema.
do $$
declare
  expected_rpc text;
  rpc regprocedure;
begin
  foreach expected_rpc in array array[
    'public.claim_notification_device(text,text,text,text)',
    'public.request_autonomous_agent_run()',
    'public.set_auto_watch_recommendation_preferences(boolean,integer,numeric,integer)',
    'public.set_auto_watch_recommendation_preferences_v2(boolean,integer,numeric,integer,text,numeric,numeric,numeric,text[])'
  ]
  loop
    rpc := to_regprocedure(expected_rpc);
    if rpc is null then
      raise exception 'Public schema hardening refused: required authenticated invoker RPC is missing: %', expected_rpc;
    end if;
    if (select p.prosecdef from pg_proc p where p.oid = rpc) then
      raise exception 'Public schema hardening refused: authenticated RPC remains SECURITY DEFINER: %', expected_rpc;
    end if;
    execute format('revoke all privileges on function %s from public, anon, service_role', rpc);
    execute format('grant execute on function %s to authenticated', rpc);
  end loop;
end;
$$;

commit;

notify pgrst, 'reload schema';
