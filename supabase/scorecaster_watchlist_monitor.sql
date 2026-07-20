-- Scorecaster Watchlist Monitor V1
-- Run after scorecaster_watchlist_alerts.sql, scorecaster_alert_inbox.sql and scorecaster_market_timeline.sql.
-- Safe to run more than once. Monitoring remains disabled until server configuration is complete.

create table if not exists public.watchlist_monitor_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_check_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text not null default 'idle',
  last_error text,
  last_items_count integer not null default 0,
  last_alerts_count integer not null default 0,
  last_snapshots_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.watchlist_monitor_state add column if not exists next_check_at timestamptz not null default now();
alter table public.watchlist_monitor_state add column if not exists lease_expires_at timestamptz;
alter table public.watchlist_monitor_state add column if not exists last_started_at timestamptz;
alter table public.watchlist_monitor_state add column if not exists last_completed_at timestamptz;
alter table public.watchlist_monitor_state add column if not exists last_status text not null default 'idle';
alter table public.watchlist_monitor_state add column if not exists last_error text;
alter table public.watchlist_monitor_state add column if not exists last_items_count integer not null default 0;
alter table public.watchlist_monitor_state add column if not exists last_alerts_count integer not null default 0;
alter table public.watchlist_monitor_state add column if not exists last_snapshots_count integer not null default 0;
alter table public.watchlist_monitor_state add column if not exists updated_at timestamptz not null default now();

alter table public.watchlist_monitor_state drop constraint if exists watchlist_monitor_status_allowed;
alter table public.watchlist_monitor_state add constraint watchlist_monitor_status_allowed
  check (last_status in ('idle', 'running', 'success', 'error')) not valid;

alter table public.watchlist_monitor_state drop constraint if exists watchlist_monitor_counts_nonnegative;
alter table public.watchlist_monitor_state add constraint watchlist_monitor_counts_nonnegative
  check (last_items_count >= 0 and last_alerts_count >= 0 and last_snapshots_count >= 0) not valid;

alter table public.watchlist_monitor_state drop constraint if exists watchlist_monitor_error_length;
alter table public.watchlist_monitor_state add constraint watchlist_monitor_error_length
  check (last_error is null or char_length(last_error) <= 500) not valid;

create index if not exists idx_watchlist_monitor_due
  on public.watchlist_monitor_state(next_check_at, lease_expires_at);

create or replace function public.set_watchlist_monitor_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists watchlist_monitor_set_updated_at on public.watchlist_monitor_state;
create trigger watchlist_monitor_set_updated_at
before update on public.watchlist_monitor_state
for each row execute function public.set_watchlist_monitor_updated_at();

create or replace function public.schedule_watchlist_monitor_for_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid;
begin
  v_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  if tg_op = 'DELETE' and not exists (
    select 1 from public.watchlist_items where user_id = v_user_id
  ) then
    delete from public.watchlist_monitor_state where user_id = v_user_id;
    return old;
  end if;

  insert into public.watchlist_monitor_state (user_id, next_check_at, last_status)
  values (v_user_id, now(), 'idle')
  on conflict (user_id) do update
    set next_check_at = least(public.watchlist_monitor_state.next_check_at, now()),
        last_status = case
          when public.watchlist_monitor_state.last_status = 'running' then 'running'
          else 'idle'
        end,
        last_error = null;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists watchlist_items_schedule_monitor on public.watchlist_items;
create trigger watchlist_items_schedule_monitor
after insert or update or delete on public.watchlist_items
for each row execute function public.schedule_watchlist_monitor_for_user();

insert into public.watchlist_monitor_state (user_id, next_check_at, last_status)
select distinct user_id, now(), 'idle'
from public.watchlist_items
on conflict (user_id) do nothing;

create or replace function public.claim_watchlist_monitor_users(p_limit integer default 20)
returns table(user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with claimed as (
    select state.user_id
    from public.watchlist_monitor_state state
    where state.next_check_at <= now()
      and (state.lease_expires_at is null or state.lease_expires_at < now())
    order by state.next_check_at asc, state.updated_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 20))
  )
  update public.watchlist_monitor_state state
  set lease_expires_at = now() + interval '10 minutes',
      last_started_at = now(),
      last_status = 'running',
      last_error = null,
      next_check_at = now() + interval '15 minutes'
  from claimed
  where state.user_id = claimed.user_id
  returning state.user_id;
end;
$$;

create or replace function public.complete_watchlist_monitor_user(
  p_user_id uuid,
  p_status text,
  p_items_count integer default 0,
  p_alerts_count integer default 0,
  p_snapshots_count integer default 0,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('success', 'error') then
    raise exception 'Unsupported monitor status';
  end if;

  update public.watchlist_monitor_state
  set lease_expires_at = null,
      last_completed_at = now(),
      last_status = p_status,
      last_error = nullif(left(coalesce(p_error, ''), 500), ''),
      last_items_count = greatest(0, coalesce(p_items_count, 0)),
      last_alerts_count = greatest(0, coalesce(p_alerts_count, 0)),
      last_snapshots_count = greatest(0, coalesce(p_snapshots_count, 0)),
      next_check_at = case
        when p_status = 'error' then now() + interval '5 minutes'
        else now() + interval '15 minutes'
      end
  where user_id = p_user_id;
end;
$$;

alter table public.watchlist_monitor_state enable row level security;
alter table public.watchlist_monitor_state force row level security;

drop policy if exists "Users read own watchlist monitor state" on public.watchlist_monitor_state;
create policy "Users read own watchlist monitor state"
on public.watchlist_monitor_state for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.watchlist_monitor_state from anon;
revoke insert, update, delete on public.watchlist_monitor_state from authenticated;
grant select on public.watchlist_monitor_state to authenticated;
revoke all on function public.claim_watchlist_monitor_users(integer) from public;
revoke all on function public.complete_watchlist_monitor_user(uuid, text, integer, integer, integer, text) from public;
grant execute on function public.claim_watchlist_monitor_users(integer) to service_role;
grant execute on function public.complete_watchlist_monitor_user(uuid, text, integer, integer, integer, text) to service_role;