-- Scorecaster Auto-Watch Recommendations V1
-- Persistent user opt-in and bounded background scheduling for automatic Top 1-3 recommendation monitoring.
-- Paper-only: this registry creates/refreshes watchlist rows only. It never creates stakes or real-money actions.

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
  updated_at timestamptz not null default now(),
  constraint auto_watch_top_n_range check (top_n between 1 and 3),
  constraint auto_watch_move_range check (alert_move_percent between 0.005 and 0.5),
  constraint auto_watch_before_range check (alert_before_minutes between 15 and 10080),
  constraint auto_watch_status_allowed check (last_status in ('idle', 'running', 'success', 'error')),
  constraint auto_watch_counts_nonnegative check (last_synced_count >= 0 and last_removed_count >= 0),
  constraint auto_watch_error_length check (last_error is null or char_length(last_error) <= 500)
);

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

create or replace function public.set_auto_watch_recommendation_preferences(
  p_enabled boolean,
  p_top_n integer default 3,
  p_alert_move_percent numeric default 0.03,
  p_alert_before_minutes integer default 120
)
returns public.auto_watch_recommendation_preferences
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.auto_watch_recommendation_preferences;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_top_n is null or p_top_n < 1 or p_top_n > 3 then
    raise exception 'top_n must be between 1 and 3';
  end if;
  if p_alert_move_percent is null or p_alert_move_percent < 0.005 or p_alert_move_percent > 0.5 then
    raise exception 'alert_move_percent is outside the allowed range';
  end if;
  if p_alert_before_minutes is null or p_alert_before_minutes < 15 or p_alert_before_minutes > 10080 then
    raise exception 'alert_before_minutes is outside the allowed range';
  end if;

  insert into public.auto_watch_recommendation_preferences as prefs (
    user_id, enabled, top_n, alert_move_percent, alert_before_minutes, next_sync_at, last_status, last_error
  ) values (
    v_user_id,
    coalesce(p_enabled, false),
    p_top_n,
    p_alert_move_percent,
    p_alert_before_minutes,
    now(),
    'idle',
    null
  )
  on conflict (user_id) do update
  set enabled = excluded.enabled,
      top_n = excluded.top_n,
      alert_move_percent = excluded.alert_move_percent,
      alert_before_minutes = excluded.alert_before_minutes,
      next_sync_at = now(),
      lease_expires_at = null,
      last_status = 'idle',
      last_error = null
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.claim_auto_watch_recommendation_users(p_limit integer default 20)
returns table(
  user_id uuid,
  top_n smallint,
  alert_move_percent numeric,
  alert_before_minutes integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  returning prefs.user_id, prefs.top_n, prefs.alert_move_percent, prefs.alert_before_minutes;
end;
$$;

create or replace function public.complete_auto_watch_recommendation_user(
  p_user_id uuid,
  p_status text,
  p_synced_count integer default 0,
  p_removed_count integer default 0,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('success', 'error') then
    raise exception 'Unsupported auto-watch status';
  end if;

  update public.auto_watch_recommendation_preferences
  set lease_expires_at = null,
      last_completed_at = now(),
      last_status = p_status,
      last_error = nullif(left(coalesce(p_error, ''), 500), ''),
      last_synced_count = greatest(0, coalesce(p_synced_count, 0)),
      last_removed_count = greatest(0, coalesce(p_removed_count, 0)),
      next_sync_at = case
        when p_status = 'error' then now() + interval '5 minutes'
        else now() + interval '15 minutes'
      end
  where user_id = p_user_id;
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

-- PostgreSQL functions receive PUBLIC EXECUTE by default. Revoke both PUBLIC and
-- concrete API roles explicitly before granting the narrow intended callers.
revoke execute on function public.set_auto_watch_recommendation_preferences(boolean, integer, numeric, integer) from public, anon, service_role;
grant execute on function public.set_auto_watch_recommendation_preferences(boolean, integer, numeric, integer) to authenticated;

revoke execute on function public.claim_auto_watch_recommendation_users(integer) from public, anon, authenticated;
revoke execute on function public.complete_auto_watch_recommendation_user(uuid, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.claim_auto_watch_recommendation_users(integer) to service_role;
grant execute on function public.complete_auto_watch_recommendation_user(uuid, text, integer, integer, integer, text) to service_role;
