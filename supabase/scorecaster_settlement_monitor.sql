-- Scorecaster Settlement Monitor V1
-- Run after scorecaster_auth_cloud.sql and scorecaster_api_rate_limits.sql.
-- Safe to run more than once. Monitoring remains disabled until server configuration is complete.

create table if not exists public.paper_settlement_monitor_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_check_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text not null default 'idle',
  last_error text,
  last_open_count integer not null default 0,
  last_settled_count integer not null default 0,
  last_pending_count integer not null default 0,
  last_provider_warnings_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.paper_settlement_monitor_state add column if not exists next_check_at timestamptz not null default now();
alter table public.paper_settlement_monitor_state add column if not exists lease_expires_at timestamptz;
alter table public.paper_settlement_monitor_state add column if not exists last_started_at timestamptz;
alter table public.paper_settlement_monitor_state add column if not exists last_completed_at timestamptz;
alter table public.paper_settlement_monitor_state add column if not exists last_status text not null default 'idle';
alter table public.paper_settlement_monitor_state add column if not exists last_error text;
alter table public.paper_settlement_monitor_state add column if not exists last_open_count integer not null default 0;
alter table public.paper_settlement_monitor_state add column if not exists last_settled_count integer not null default 0;
alter table public.paper_settlement_monitor_state add column if not exists last_pending_count integer not null default 0;
alter table public.paper_settlement_monitor_state add column if not exists last_provider_warnings_count integer not null default 0;
alter table public.paper_settlement_monitor_state add column if not exists updated_at timestamptz not null default now();

alter table public.paper_settlement_monitor_state drop constraint if exists paper_settlement_monitor_status_allowed;
alter table public.paper_settlement_monitor_state add constraint paper_settlement_monitor_status_allowed
  check (last_status in ('idle', 'running', 'success', 'error', 'deferred')) not valid;

alter table public.paper_settlement_monitor_state drop constraint if exists paper_settlement_monitor_counts_nonnegative;
alter table public.paper_settlement_monitor_state add constraint paper_settlement_monitor_counts_nonnegative
  check (
    last_open_count >= 0 and
    last_settled_count >= 0 and
    last_pending_count >= 0 and
    last_provider_warnings_count >= 0
  ) not valid;

alter table public.paper_settlement_monitor_state drop constraint if exists paper_settlement_monitor_error_length;
alter table public.paper_settlement_monitor_state add constraint paper_settlement_monitor_error_length
  check (last_error is null or char_length(last_error) <= 500) not valid;

create index if not exists idx_paper_settlement_monitor_due
  on public.paper_settlement_monitor_state(next_check_at, lease_expires_at);

create or replace function public.set_paper_settlement_monitor_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists paper_settlement_monitor_set_updated_at on public.paper_settlement_monitor_state;
create trigger paper_settlement_monitor_set_updated_at
before update on public.paper_settlement_monitor_state
for each row execute function public.set_paper_settlement_monitor_updated_at();

create or replace function public.schedule_paper_settlement_monitor_for_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid;
begin
  v_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  if not exists (
    select 1 from public.bets
    where user_id = v_user_id and status = 'open'
  ) then
    delete from public.paper_settlement_monitor_state where user_id = v_user_id;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  insert into public.paper_settlement_monitor_state (user_id, next_check_at, last_status)
  values (v_user_id, now(), 'idle')
  on conflict (user_id) do update
    set next_check_at = least(public.paper_settlement_monitor_state.next_check_at, now()),
        last_status = case
          when public.paper_settlement_monitor_state.last_status = 'running' then 'running'
          else 'idle'
        end,
        last_error = null;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists bets_schedule_paper_settlement_monitor on public.bets;
create trigger bets_schedule_paper_settlement_monitor
after insert or update or delete on public.bets
for each row execute function public.schedule_paper_settlement_monitor_for_user();

insert into public.paper_settlement_monitor_state (user_id, next_check_at, last_status)
select distinct user_id, now(), 'idle'
from public.bets
where status = 'open'
on conflict (user_id) do nothing;

create or replace function public.claim_paper_settlement_monitor_users(p_limit integer default 20)
returns table(user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with claimed as (
    select state.user_id
    from public.paper_settlement_monitor_state state
    where state.next_check_at <= now()
      and (state.lease_expires_at is null or state.lease_expires_at < now())
    order by state.next_check_at asc, state.updated_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 20))
  )
  update public.paper_settlement_monitor_state state
  set lease_expires_at = now() + interval '10 minutes',
      last_started_at = now(),
      last_status = 'running',
      last_error = null,
      next_check_at = now() + interval '60 minutes'
  from claimed
  where state.user_id = claimed.user_id
  returning state.user_id;
end;
$$;

create or replace function public.complete_paper_settlement_monitor_user(
  p_user_id uuid,
  p_status text,
  p_open_count integer default 0,
  p_settled_count integer default 0,
  p_pending_count integer default 0,
  p_provider_warnings_count integer default 0,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('success', 'error', 'deferred') then
    raise exception 'Unsupported settlement monitor status';
  end if;

  update public.paper_settlement_monitor_state
  set lease_expires_at = null,
      last_completed_at = now(),
      last_status = p_status,
      last_error = nullif(left(coalesce(p_error, ''), 500), ''),
      last_open_count = greatest(0, coalesce(p_open_count, 0)),
      last_settled_count = greatest(0, coalesce(p_settled_count, 0)),
      last_pending_count = greatest(0, coalesce(p_pending_count, 0)),
      last_provider_warnings_count = greatest(0, coalesce(p_provider_warnings_count, 0)),
      next_check_at = case
        when p_status = 'error' then now() + interval '15 minutes'
        else now() + interval '60 minutes'
      end
  where user_id = p_user_id;
end;
$$;

alter table public.paper_settlement_monitor_state enable row level security;
alter table public.paper_settlement_monitor_state force row level security;

drop policy if exists "Users read own paper settlement monitor state" on public.paper_settlement_monitor_state;
create policy "Users read own paper settlement monitor state"
on public.paper_settlement_monitor_state for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.paper_settlement_monitor_state from anon;
revoke insert, update, delete on public.paper_settlement_monitor_state from authenticated;
grant select on public.paper_settlement_monitor_state to authenticated;
revoke all on function public.claim_paper_settlement_monitor_users(integer) from public;
revoke all on function public.complete_paper_settlement_monitor_user(uuid, text, integer, integer, integer, integer, text) from public;
grant execute on function public.claim_paper_settlement_monitor_users(integer) to service_role;
grant execute on function public.complete_paper_settlement_monitor_user(uuid, text, integer, integer, integer, integer, text) to service_role;
