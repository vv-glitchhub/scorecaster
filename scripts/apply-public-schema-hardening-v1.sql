-- Scorecaster public-schema hardening V1
-- Idempotent production patch based on the 2026-08-04 Supabase privilege export.
-- This script does not drop tables, columns, rows or existing policies.
-- It preserves server-side access through service_role and narrows browser roles.
-- Reviewed client grants are restored only when matching RLS policies exist.

begin;

-- Server-internal and legacy data surfaces. Ordinary tables receive RLS and
-- FORCE RLS. Views cannot use RLS, so their browser grants are revoked instead.
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

-- User-owned paper rows. Existing RLS policies remain the source of row scope.
-- If the table exists but a required policy command is missing, abort the whole
-- transaction instead of restoring a broad authenticated grant without RLS.
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
            select 1
            from unnest(p.roles) as policy_role
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

-- User preferences. The legacy production table is intentionally not recreated
-- or reshaped here. Existing policy-backed SELECT/INSERT/UPDATE access is kept;
-- direct DELETE remains revoked. Missing policy support aborts the migration.
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
            select 1
            from unnest(p.roles) as policy_role
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
-- The reviewed grant matrix is restored only after all four matching policy
-- commands are found. A missing policy rolls back the complete hardening patch.
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
            select 1
            from unnest(p.roles) as policy_role
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

commit;

notify pgrst, 'reload schema';
