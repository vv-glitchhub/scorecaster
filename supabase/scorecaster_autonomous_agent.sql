-- Scorecaster Autonomous Paper Agent V1
-- Run after scorecaster_auth_cloud.sql and scorecaster_paper_risk_limits.sql.
-- Safe to run more than once. The agent is opt-in and remains inactive until server configuration is complete.

create table if not exists public.autonomous_agent_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  sports text[] not null default '{}'::text[],
  daily_pick_limit integer not null default 3,
  min_priority_score numeric not null default 0.62,
  min_odds numeric not null default 1.20,
  max_odds numeric not null default 5.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.autonomous_agent_settings add column if not exists enabled boolean not null default false;
alter table public.autonomous_agent_settings add column if not exists sports text[] not null default '{}'::text[];
alter table public.autonomous_agent_settings add column if not exists daily_pick_limit integer not null default 3;
alter table public.autonomous_agent_settings add column if not exists min_priority_score numeric not null default 0.62;
alter table public.autonomous_agent_settings add column if not exists min_odds numeric not null default 1.20;
alter table public.autonomous_agent_settings add column if not exists max_odds numeric not null default 5.00;
alter table public.autonomous_agent_settings add column if not exists updated_at timestamptz not null default now();

alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_sports_limit;
alter table public.autonomous_agent_settings add constraint autonomous_agent_sports_limit
  check (cardinality(sports) <= 6) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_pick_limit;
alter table public.autonomous_agent_settings add constraint autonomous_agent_pick_limit
  check (daily_pick_limit between 1 and 3) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_priority_range;
alter table public.autonomous_agent_settings add constraint autonomous_agent_priority_range
  check (min_priority_score between 0.50 and 1.00) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_odds_range;
alter table public.autonomous_agent_settings add constraint autonomous_agent_odds_range
  check (min_odds >= 1.01 and max_odds <= 20 and max_odds >= min_odds) not valid;

create table if not exists public.autonomous_agent_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_check_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text not null default 'idle',
  last_error text,
  last_run_id uuid,
  last_candidate_count integer not null default 0,
  last_selected_count integer not null default 0,
  last_saved_count integer not null default 0,
  last_skipped_count integer not null default 0,
  last_total_stake numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.autonomous_agent_state add column if not exists next_check_at timestamptz not null default now();
alter table public.autonomous_agent_state add column if not exists lease_expires_at timestamptz;
alter table public.autonomous_agent_state add column if not exists last_started_at timestamptz;
alter table public.autonomous_agent_state add column if not exists last_completed_at timestamptz;
alter table public.autonomous_agent_state add column if not exists last_status text not null default 'idle';
alter table public.autonomous_agent_state add column if not exists last_error text;
alter table public.autonomous_agent_state add column if not exists last_run_id uuid;
alter table public.autonomous_agent_state add column if not exists last_candidate_count integer not null default 0;
alter table public.autonomous_agent_state add column if not exists last_selected_count integer not null default 0;
alter table public.autonomous_agent_state add column if not exists last_saved_count integer not null default 0;
alter table public.autonomous_agent_state add column if not exists last_skipped_count integer not null default 0;
alter table public.autonomous_agent_state add column if not exists last_total_stake numeric not null default 0;
alter table public.autonomous_agent_state add column if not exists updated_at timestamptz not null default now();

alter table public.autonomous_agent_state drop constraint if exists autonomous_agent_state_status_allowed;
alter table public.autonomous_agent_state add constraint autonomous_agent_state_status_allowed
  check (last_status in ('idle', 'running', 'success', 'error', 'deferred')) not valid;
alter table public.autonomous_agent_state drop constraint if exists autonomous_agent_state_counts_nonnegative;
alter table public.autonomous_agent_state add constraint autonomous_agent_state_counts_nonnegative
  check (
    last_candidate_count >= 0 and last_selected_count >= 0 and
    last_saved_count >= 0 and last_skipped_count >= 0 and last_total_stake >= 0
  ) not valid;
alter table public.autonomous_agent_state drop constraint if exists autonomous_agent_state_error_length;
alter table public.autonomous_agent_state add constraint autonomous_agent_state_error_length
  check (last_error is null or char_length(last_error) <= 500) not valid;

create table if not exists public.autonomous_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'running',
  candidate_count integer not null default 0,
  selected_count integer not null default 0,
  saved_count integer not null default 0,
  skipped_count integer not null default 0,
  total_stake numeric not null default 0,
  sports text[] not null default '{}'::text[],
  summary jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.autonomous_agent_runs add column if not exists status text not null default 'running';
alter table public.autonomous_agent_runs add column if not exists candidate_count integer not null default 0;
alter table public.autonomous_agent_runs add column if not exists selected_count integer not null default 0;
alter table public.autonomous_agent_runs add column if not exists saved_count integer not null default 0;
alter table public.autonomous_agent_runs add column if not exists skipped_count integer not null default 0;
alter table public.autonomous_agent_runs add column if not exists total_stake numeric not null default 0;
alter table public.autonomous_agent_runs add column if not exists sports text[] not null default '{}'::text[];
alter table public.autonomous_agent_runs add column if not exists summary jsonb not null default '{}'::jsonb;
alter table public.autonomous_agent_runs add column if not exists error text;
alter table public.autonomous_agent_runs add column if not exists completed_at timestamptz;

alter table public.autonomous_agent_runs drop constraint if exists autonomous_agent_run_status_allowed;
alter table public.autonomous_agent_runs add constraint autonomous_agent_run_status_allowed
  check (status in ('running', 'success', 'error', 'deferred')) not valid;
alter table public.autonomous_agent_runs drop constraint if exists autonomous_agent_run_counts_nonnegative;
alter table public.autonomous_agent_runs add constraint autonomous_agent_run_counts_nonnegative
  check (
    candidate_count >= 0 and selected_count >= 0 and saved_count >= 0 and
    skipped_count >= 0 and total_stake >= 0
  ) not valid;
alter table public.autonomous_agent_runs drop constraint if exists autonomous_agent_run_error_length;
alter table public.autonomous_agent_runs add constraint autonomous_agent_run_error_length
  check (error is null or char_length(error) <= 500) not valid;

create index if not exists idx_autonomous_agent_due
  on public.autonomous_agent_state(next_check_at, lease_expires_at);
create index if not exists idx_autonomous_agent_runs_user_created
  on public.autonomous_agent_runs(user_id, created_at desc);

create or replace function public.set_autonomous_agent_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists autonomous_agent_settings_set_updated_at on public.autonomous_agent_settings;
create trigger autonomous_agent_settings_set_updated_at
before update on public.autonomous_agent_settings
for each row execute function public.set_autonomous_agent_updated_at();

drop trigger if exists autonomous_agent_state_set_updated_at on public.autonomous_agent_state;
create trigger autonomous_agent_state_set_updated_at
before update on public.autonomous_agent_state
for each row execute function public.set_autonomous_agent_updated_at();

create or replace function public.schedule_autonomous_agent_for_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.enabled then
    insert into public.autonomous_agent_state (user_id, next_check_at, last_status)
    values (new.user_id, now(), 'idle')
    on conflict (user_id) do update
      set next_check_at = least(public.autonomous_agent_state.next_check_at, now()),
          last_status = case
            when public.autonomous_agent_state.last_status = 'running' then 'running'
            else 'idle'
          end,
          last_error = null;
  else
    delete from public.autonomous_agent_state where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists autonomous_agent_settings_schedule on public.autonomous_agent_settings;
create trigger autonomous_agent_settings_schedule
after insert or update of enabled, sports, daily_pick_limit, min_priority_score, min_odds, max_odds
on public.autonomous_agent_settings
for each row execute function public.schedule_autonomous_agent_for_user();

insert into public.autonomous_agent_state (user_id, next_check_at, last_status)
select user_id, now(), 'idle'
from public.autonomous_agent_settings
where enabled = true
on conflict (user_id) do nothing;

create or replace function public.claim_autonomous_agent_users(p_limit integer default 10)
returns table(user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with claimed as (
    select state.user_id
    from public.autonomous_agent_state state
    join public.autonomous_agent_settings settings on settings.user_id = state.user_id
    where settings.enabled = true
      and state.next_check_at <= now()
      and (state.lease_expires_at is null or state.lease_expires_at < now())
    order by state.next_check_at asc, state.updated_at asc
    for update of state skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 10))
  )
  update public.autonomous_agent_state state
  set lease_expires_at = now() + interval '10 minutes',
      last_started_at = now(),
      last_status = 'running',
      last_error = null,
      next_check_at = now() + interval '24 hours'
  from claimed
  where state.user_id = claimed.user_id
  returning state.user_id;
end;
$$;

create or replace function public.complete_autonomous_agent_user(
  p_user_id uuid,
  p_status text,
  p_run_id uuid default null,
  p_candidate_count integer default 0,
  p_selected_count integer default 0,
  p_saved_count integer default 0,
  p_skipped_count integer default 0,
  p_total_stake numeric default 0,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('success', 'error', 'deferred') then
    raise exception 'Unsupported autonomous agent status';
  end if;

  update public.autonomous_agent_state
  set lease_expires_at = null,
      last_completed_at = now(),
      last_status = p_status,
      last_error = nullif(left(coalesce(p_error, ''), 500), ''),
      last_run_id = p_run_id,
      last_candidate_count = greatest(0, coalesce(p_candidate_count, 0)),
      last_selected_count = greatest(0, coalesce(p_selected_count, 0)),
      last_saved_count = greatest(0, coalesce(p_saved_count, 0)),
      last_skipped_count = greatest(0, coalesce(p_skipped_count, 0)),
      last_total_stake = greatest(0, coalesce(p_total_stake, 0)),
      next_check_at = case
        when p_status = 'error' then now() + interval '60 minutes'
        when p_status = 'deferred' then now() + interval '6 hours'
        else now() + interval '24 hours'
      end
  where user_id = p_user_id;
end;
$$;

create or replace function public.request_autonomous_agent_run()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return false; end if;
  if not exists (
    select 1 from public.autonomous_agent_settings
    where user_id = v_user_id and enabled = true
  ) then return false; end if;

  insert into public.autonomous_agent_state (user_id, next_check_at, last_status)
  values (v_user_id, now(), 'idle')
  on conflict (user_id) do update
    set next_check_at = now(),
        last_status = case
          when public.autonomous_agent_state.last_status = 'running' then 'running'
          else 'idle'
        end,
        last_error = null;
  return true;
end;
$$;

alter table public.autonomous_agent_settings enable row level security;
alter table public.autonomous_agent_settings force row level security;
alter table public.autonomous_agent_state enable row level security;
alter table public.autonomous_agent_state force row level security;
alter table public.autonomous_agent_runs enable row level security;
alter table public.autonomous_agent_runs force row level security;

drop policy if exists "Users manage own autonomous agent settings" on public.autonomous_agent_settings;
create policy "Users manage own autonomous agent settings"
on public.autonomous_agent_settings for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users read own autonomous agent state" on public.autonomous_agent_state;
create policy "Users read own autonomous agent state"
on public.autonomous_agent_state for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own autonomous agent runs" on public.autonomous_agent_runs;
create policy "Users read own autonomous agent runs"
on public.autonomous_agent_runs for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.autonomous_agent_settings from anon;
revoke all on public.autonomous_agent_state from anon;
revoke all on public.autonomous_agent_runs from anon;
grant select, insert, update, delete on public.autonomous_agent_settings to authenticated;
grant select on public.autonomous_agent_state to authenticated;
grant select on public.autonomous_agent_runs to authenticated;
revoke insert, update, delete on public.autonomous_agent_state from authenticated;
revoke insert, update, delete on public.autonomous_agent_runs from authenticated;

revoke all on function public.claim_autonomous_agent_users(integer) from public;
revoke all on function public.complete_autonomous_agent_user(uuid, text, uuid, integer, integer, integer, integer, numeric, text) from public;
revoke all on function public.request_autonomous_agent_run() from public;
grant execute on function public.claim_autonomous_agent_users(integer) to service_role;
grant execute on function public.complete_autonomous_agent_user(uuid, text, uuid, integer, integer, integer, integer, numeric, text) to service_role;
grant execute on function public.request_autonomous_agent_run() to authenticated;
