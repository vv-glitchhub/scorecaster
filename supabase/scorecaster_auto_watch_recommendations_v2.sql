-- Scorecaster Auto-Watch Recommendations V2
-- Canonical, forward-only migration. Expands the existing V1 preference registry with
-- user-controlled paper-only filters while preserving manual Watchlist ownership.

create table if not exists public.auto_watch_recommendation_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  top_n smallint not null default 3,
  alert_move_percent numeric not null default 0.03,
  alert_before_minutes integer not null default 120,
  next_sync_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text not null default 'idle',
  last_error text,
  last_synced_count integer not null default 0,
  last_removed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.auto_watch_recommendation_preferences
  add column if not exists selection_mode text not null default 'play-and-caution',
  add column if not exists min_score numeric not null default 0,
  add column if not exists min_edge numeric not null default 0,
  add column if not exists min_ev numeric not null default 0,
  add column if not exists sport_keys text[] not null default '{}'::text[];

alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_top_n_range;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_top_n_range check (top_n between 1 and 10);
alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_move_range;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_move_range check (alert_move_percent between 0.005 and 0.5);
alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_before_range;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_before_range check (alert_before_minutes between 15 and 10080);
alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_status_allowed;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_status_allowed check (last_status in ('idle', 'running', 'success', 'error'));
alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_counts_nonnegative;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_counts_nonnegative check (last_synced_count >= 0 and last_removed_count >= 0);
alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_error_length;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_error_length check (last_error is null or char_length(last_error) <= 500);
alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_selection_mode_allowed;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_selection_mode_allowed check (selection_mode in ('play-only', 'play-and-caution'));
alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_min_score_range;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_min_score_range check (min_score between 0 and 100);
alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_min_edge_range;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_min_edge_range check (min_edge between 0 and 0.20);
alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_min_ev_range;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_min_ev_range check (min_ev between 0 and 1.00);
alter table public.auto_watch_recommendation_preferences drop constraint if exists auto_watch_sport_keys_count;
alter table public.auto_watch_recommendation_preferences add constraint auto_watch_sport_keys_count check (cardinality(sport_keys) <= 20);

create index if not exists idx_auto_watch_recommendations_due
  on public.auto_watch_recommendation_preferences(enabled, next_sync_at, lease_expires_at);

create or replace function public.set_auto_watch_recommendations_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists auto_watch_recommendations_set_updated_at on public.auto_watch_recommendation_preferences;
create trigger auto_watch_recommendations_set_updated_at
before update on public.auto_watch_recommendation_preferences
for each row execute function public.set_auto_watch_recommendations_updated_at();

create or replace function public.set_auto_watch_recommendation_preferences_v2(
  p_enabled boolean,
  p_top_n integer default 3,
  p_alert_move_percent numeric default 0.03,
  p_alert_before_minutes integer default 120,
  p_selection_mode text default 'play-and-caution',
  p_min_score numeric default 0,
  p_min_edge numeric default 0,
  p_min_ev numeric default 0,
  p_sport_keys text[] default '{}'::text[]
)
returns public.auto_watch_recommendation_preferences
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_sport_keys text[] := coalesce(p_sport_keys, '{}'::text[]);
  v_row public.auto_watch_recommendation_preferences;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_top_n is null or p_top_n < 1 or p_top_n > 10 then
    raise exception 'top_n must be between 1 and 10';
  end if;
  if p_alert_move_percent is null or p_alert_move_percent < 0.005 or p_alert_move_percent > 0.5 then
    raise exception 'alert_move_percent is outside the allowed range';
  end if;
  if p_alert_before_minutes is null or p_alert_before_minutes < 15 or p_alert_before_minutes > 10080 then
    raise exception 'alert_before_minutes is outside the allowed range';
  end if;
  if p_selection_mode not in ('play-only', 'play-and-caution') then
    raise exception 'selection_mode is unsupported';
  end if;
  if p_min_score is null or p_min_score < 0 or p_min_score > 100 then
    raise exception 'min_score is outside the allowed range';
  end if;
  if p_min_edge is null or p_min_edge < 0 or p_min_edge > 0.20 then
    raise exception 'min_edge is outside the allowed range';
  end if;
  if p_min_ev is null or p_min_ev < 0 or p_min_ev > 1.00 then
    raise exception 'min_ev is outside the allowed range';
  end if;
  if cardinality(v_sport_keys) > 20 or exists (
    select 1 from unnest(v_sport_keys) as sport_key
    where length(btrim(sport_key)) < 1 or length(sport_key) > 120 or sport_key !~ '^[a-z0-9_:-]+$'
  ) then
    raise exception 'sport_keys contains an invalid filter';
  end if;

  insert into public.auto_watch_recommendation_preferences as prefs (
    user_id, enabled, top_n, alert_move_percent, alert_before_minutes,
    selection_mode, min_score, min_edge, min_ev, sport_keys,
    next_sync_at, last_status, last_error
  ) values (
    v_user_id, coalesce(p_enabled, false), p_top_n, p_alert_move_percent, p_alert_before_minutes,
    p_selection_mode, p_min_score, p_min_edge, p_min_ev, v_sport_keys,
    now(), 'idle', null
  )
  on conflict (user_id) do update
  set enabled = excluded.enabled,
      top_n = excluded.top_n,
      alert_move_percent = excluded.alert_move_percent,
      alert_before_minutes = excluded.alert_before_minutes,
      selection_mode = excluded.selection_mode,
      min_score = excluded.min_score,
      min_edge = excluded.min_edge,
      min_ev = excluded.min_ev,
      sport_keys = excluded.sport_keys,
      next_sync_at = now(),
      lease_expires_at = null,
      last_status = 'idle',
      last_error = null
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.claim_auto_watch_recommendation_users_v2(p_limit integer default 20)
returns table(
  user_id uuid,
  top_n smallint,
  alert_move_percent numeric,
  alert_before_minutes integer,
  selection_mode text,
  min_score numeric,
  min_edge numeric,
  min_ev numeric,
  sport_keys text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$;
begin
  return query
  with claimed as (
    select prefs.user_id
    from public.auto_watch_recommendation_preferences prefs
    where prefs.enabled = true
      and prefs.next_sync_at <= now()
      and (prefs.lease_expires_at is null or prefs.lease_expires_at < now())
    order by prefs.next_sync_at asc, prefs.updated_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 20))
  )
  update public.auto_watch_recommendation_preferences prefs
  set lease_expires_at = now() + interval '10 minutes',
      last_started_at = now(),
      last_status = 'running',
      last_error = null,
      next_sync_at = now() + interval '15 minutes'
  from claimed
  where prefs.user_id = claimed.user_id
  returning prefs.user_id, prefs.top_n, prefs.alert_move_percent, prefs.alert_before_minutes,
            prefs.selection_mode, prefs.min_score, prefs.min_edge, prefs.min_ev, prefs.sport_keys;
end;
$$;

alter table public.auto_watch_recommendation_preferences enable row level security;
alter table public.auto_watch_recommendation_preferences force row level security;

drop policy if exists "Users read own auto watch recommendation preferences" on public.auto_watch_recommendation_preferences;
create policy "Users read own auto watch recommendation preferences"
on public.auto_watch_recommendation_preferences for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.auto_watch_recommendation_preferences from anon;
revoke insert, update, delete on public.auto_watch_recommendation_preferences from authenticated;
grant select on public.auto_watch_recommendation_preferences to authenticated;

revoke execute on function public.set_auto_watch_recommendation_preferences_v2(boolean, integer, numeric, integer, text, numeric, numeric, numeric, text[]) from public, anon, service_role;
grant execute on function public.set_auto_watch_recommendation_preferences_v2(boolean, integer, numeric, integer, text, numeric, numeric, numeric, text[]) to authenticated;

revoke execute on function public.claim_auto_watch_recommendation_users_v2(integer) from public, anon, authenticated;
grant execute on function public.claim_auto_watch_recommendation_users_v2(integer) to service_role;
