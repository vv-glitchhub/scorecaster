\set ON_ERROR_STOP on

-- Scorecaster public-schema hardening V1
-- Idempotent production patch based on the 2026-08-04 Supabase privilege export.
-- This script does not drop tables, columns, rows or existing policies.
-- It preserves server-side access through service_role and narrows browser roles.

begin;

-- Server-internal and legacy data surfaces. All application access must go
-- through Scorecaster server routes or protected workers using service_role.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
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
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format('alter table public.%I enable row level security', target_table);
      execute format('alter table public.%I force row level security', target_table);
      execute format('revoke all privileges on table public.%I from public, anon, authenticated', target_table);
      execute format('grant all privileges on table public.%I to service_role', target_table);
    end if;
  end loop;
end;
$$;

-- User-owned paper rows. Existing RLS policies remain the source of row scope.
do $$
begin
  if to_regclass('public.bets') is not null then
    alter table public.bets enable row level security;
    alter table public.bets force row level security;
    revoke all privileges on table public.bets from public, anon, authenticated;
    grant select, insert, update, delete on table public.bets to authenticated;
    grant all privileges on table public.bets to service_role;
  end if;
end;
$$;

-- User preferences. Existing RLS policies must restrict rows to auth.uid().
do $$
begin
  if to_regclass('public.user_settings') is not null then
    alter table public.user_settings enable row level security;
    alter table public.user_settings force row level security;
    revoke all privileges on table public.user_settings from public, anon, authenticated;
    grant select, insert, update on table public.user_settings to authenticated;
    grant all privileges on table public.user_settings to service_role;
  end if;
end;
$$;

-- Community Feed remains publicly readable, while writes require authentication
-- and are still constrained by the four reviewed owner policies.
do $$
begin
  if to_regclass('public.community_comments') is not null then
    alter table public.community_comments enable row level security;
    alter table public.community_comments force row level security;
    revoke all privileges on table public.community_comments from public, anon, authenticated;
    grant select on table public.community_comments to anon, authenticated;
    grant insert, update, delete on table public.community_comments to authenticated;
    grant all privileges on table public.community_comments to service_role;
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
