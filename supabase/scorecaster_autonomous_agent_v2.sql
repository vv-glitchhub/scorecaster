-- Scorecaster Autonomous Paper Agent V2
-- Run immediately after scorecaster_autonomous_agent.sql.
-- Extends the opt-in paper-only agent with safety pauses, adaptive cadence,
-- performance health, candidate audit rows and daily briefs.

create table if not exists public.autonomous_agent_decision_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.autonomous_agent_runs(id) on delete cascade,
  event_id text,
  match text,
  selection text,
  sport text,
  league text,
  allowed boolean not null default false,
  reasons text[] not null default '{}'::text[],
  warnings text[] not null default '{}'::text[],
  quality_score numeric,
  priority_score numeric,
  odds numeric,
  edge numeric,
  confidence numeric,
  data_coverage numeric,
  provider_count integer,
  provider_disagreement numeric,
  context_impact numeric,
  minutes_before_start numeric,
  proposed_stake numeric not null default 0,
  saved_bet_id uuid references public.bets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.autonomous_agent_daily_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brief_date date not null,
  brief jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, brief_date)
);

alter table public.autonomous_agent_settings add column if not exists min_data_coverage numeric not null default 0.60;
alter table public.autonomous_agent_settings add column if not exists min_provider_count integer not null default 1;
alter table public.autonomous_agent_settings add column if not exists max_provider_disagreement numeric not null default 0.12;
alter table public.autonomous_agent_settings add column if not exists max_drawdown_percent numeric not null default 12;
alter table public.autonomous_agent_settings add column if not exists max_daily_loss_percent numeric not null default 4;
alter table public.autonomous_agent_settings add column if not exists pause_after_losses integer not null default 5;
alter table public.autonomous_agent_settings add column if not exists cooldown_hours integer not null default 12;
alter table public.autonomous_agent_settings add column if not exists max_open_picks integer not null default 12;
alter table public.autonomous_agent_settings add column if not exists minimum_minutes_before_start integer not null default 20;
alter table public.autonomous_agent_settings add column if not exists maximum_hours_before_start integer not null default 72;
alter table public.autonomous_agent_settings add column if not exists auto_pause_on_incident boolean not null default true;
alter table public.autonomous_agent_settings add column if not exists require_unified_data boolean not null default true;
alter table public.autonomous_agent_settings add column if not exists adaptive_cadence boolean not null default true;
alter table public.autonomous_agent_settings add column if not exists shadow_learning_enabled boolean not null default true;

alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_v2_data_coverage_range;
alter table public.autonomous_agent_settings add constraint autonomous_agent_v2_data_coverage_range
  check (min_data_coverage between 0 and 1) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_v2_provider_count_range;
alter table public.autonomous_agent_settings add constraint autonomous_agent_v2_provider_count_range
  check (min_provider_count between 1 and 5) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_v2_disagreement_range;
alter table public.autonomous_agent_settings add constraint autonomous_agent_v2_disagreement_range
  check (max_provider_disagreement between 0.01 and 0.50) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_v2_drawdown_range;
alter table public.autonomous_agent_settings add constraint autonomous_agent_v2_drawdown_range
  check (max_drawdown_percent between 2 and 50 and max_daily_loss_percent between 1 and 25) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_v2_pause_range;
alter table public.autonomous_agent_settings add constraint autonomous_agent_v2_pause_range
  check (pause_after_losses between 2 and 20 and cooldown_hours between 1 and 168) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_v2_event_window_range;
alter table public.autonomous_agent_settings add constraint autonomous_agent_v2_event_window_range
  check (
    max_open_picks between 1 and 100 and
    minimum_minutes_before_start between 5 and 240 and
    maximum_hours_before_start between 2 and 168
  ) not valid;

alter table public.autonomous_agent_state add column if not exists paused_until timestamptz;
alter table public.autonomous_agent_state add column if not exists pause_reason text;
alter table public.autonomous_agent_state add column if not exists health_status text not null default 'learning';
alter table public.autonomous_agent_state add column if not exists health_score numeric not null default 50;
alter table public.autonomous_agent_state add column if not exists resolved_sample integer not null default 0;
alter table public.autonomous_agent_state add column if not exists consecutive_losses integer not null default 0;
alter table public.autonomous_agent_state add column if not exists drawdown_percent numeric not null default 0;
alter table public.autonomous_agent_state add column if not exists roi numeric;
alter table public.autonomous_agent_state add column if not exists average_clv numeric;
alter table public.autonomous_agent_state add column if not exists last_brief jsonb not null default '{}'::jsonb;

alter table public.autonomous_agent_state drop constraint if exists autonomous_agent_state_status_allowed;
alter table public.autonomous_agent_state add constraint autonomous_agent_state_status_allowed
  check (last_status in ('idle', 'running', 'success', 'error', 'deferred', 'paused')) not valid;
alter table public.autonomous_agent_state drop constraint if exists autonomous_agent_v2_health_status_allowed;
alter table public.autonomous_agent_state add constraint autonomous_agent_v2_health_status_allowed
  check (health_status in ('healthy', 'learning', 'watch', 'paused', 'blocked')) not valid;
alter table public.autonomous_agent_state drop constraint if exists autonomous_agent_v2_health_values;
alter table public.autonomous_agent_state add constraint autonomous_agent_v2_health_values
  check (
    health_score between 0 and 100 and resolved_sample >= 0 and consecutive_losses >= 0 and
    drawdown_percent >= 0 and (pause_reason is null or char_length(pause_reason) <= 500)
  ) not valid;

alter table public.autonomous_agent_runs add column if not exists health_status text;
alter table public.autonomous_agent_runs add column if not exists health_score numeric;
alter table public.autonomous_agent_runs add column if not exists guard_summary jsonb not null default '{}'::jsonb;
alter table public.autonomous_agent_runs add column if not exists next_check_minutes integer;
alter table public.autonomous_agent_runs drop constraint if exists autonomous_agent_run_status_allowed;
alter table public.autonomous_agent_runs add constraint autonomous_agent_run_status_allowed
  check (status in ('running', 'success', 'error', 'deferred', 'paused')) not valid;
alter table public.autonomous_agent_runs drop constraint if exists autonomous_agent_v2_run_health_status_allowed;
alter table public.autonomous_agent_runs add constraint autonomous_agent_v2_run_health_status_allowed
  check (health_status is null or health_status in ('healthy', 'learning', 'watch', 'paused', 'blocked')) not valid;
alter table public.autonomous_agent_runs drop constraint if exists autonomous_agent_v2_run_health_values;
alter table public.autonomous_agent_runs add constraint autonomous_agent_v2_run_health_values
  check (
    (health_score is null or health_score between 0 and 100) and
    (next_check_minutes is null or next_check_minutes between 15 and 10080)
  ) not valid;

create index if not exists idx_autonomous_agent_audit_user_created
  on public.autonomous_agent_decision_audit(user_id, created_at desc);
create index if not exists idx_autonomous_agent_audit_run
  on public.autonomous_agent_decision_audit(run_id, created_at asc);
create index if not exists idx_autonomous_agent_audit_blocked
  on public.autonomous_agent_decision_audit(user_id, allowed, created_at desc);
create index if not exists idx_autonomous_agent_briefs_user_date
  on public.autonomous_agent_daily_briefs(user_id, brief_date desc);

create or replace function public.set_autonomous_agent_brief_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists autonomous_agent_brief_set_updated_at on public.autonomous_agent_daily_briefs;
create trigger autonomous_agent_brief_set_updated_at
before update on public.autonomous_agent_daily_briefs
for each row execute function public.set_autonomous_agent_brief_updated_at();

-- Enabling paper autonomy must be sufficient for a new account to run. The
-- fixed bootstrap is intentionally stricter than the editable paper-bankroll
-- defaults and never overwrites an existing user's settings.
create or replace function public.schedule_autonomous_agent_for_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.enabled then
    insert into public.bankroll_settings (
      user_id,
      bankroll,
      max_stake_percent,
      max_daily_exposure_percent,
      max_single_league_exposure_percent,
      min_edge,
      min_confidence,
      paper_trading_mode
    ) values (
      new.user_id, 1000, 1, 5, 2.5, 0.025, 0.58, true
    )
    on conflict (user_id) do nothing;

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
after insert or update of
  enabled, sports, daily_pick_limit, min_priority_score, min_odds, max_odds,
  min_data_coverage, min_provider_count, max_provider_disagreement,
  max_drawdown_percent, max_daily_loss_percent, pause_after_losses, cooldown_hours,
  max_open_picks, minimum_minutes_before_start, maximum_hours_before_start,
  auto_pause_on_incident, require_unified_data, adaptive_cadence, shadow_learning_enabled
on public.autonomous_agent_settings
for each row execute function public.schedule_autonomous_agent_for_user();

insert into public.bankroll_settings (
  user_id,
  bankroll,
  max_stake_percent,
  max_daily_exposure_percent,
  max_single_league_exposure_percent,
  min_edge,
  min_confidence,
  paper_trading_mode
)
select user_id, 1000, 1, 5, 2.5, 0.025, 0.58, true
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
      and (state.paused_until is null or state.paused_until <= now())
    order by state.next_check_at asc, state.updated_at asc
    for update of state skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 10))
  )
  update public.autonomous_agent_state state
  set lease_expires_at = now() + interval '10 minutes',
      last_started_at = now(),
      last_status = 'running',
      last_error = null,
      next_check_at = now() + interval '6 hours'
  from claimed
  where state.user_id = claimed.user_id
  returning state.user_id;
end;
$$;

create or replace function public.complete_autonomous_agent_user_v2(
  p_user_id uuid,
  p_status text,
  p_run_id uuid default null,
  p_candidate_count integer default 0,
  p_selected_count integer default 0,
  p_saved_count integer default 0,
  p_skipped_count integer default 0,
  p_total_stake numeric default 0,
  p_error text default null,
  p_next_check_minutes integer default 180,
  p_health_status text default 'learning',
  p_health_score numeric default 50,
  p_resolved_sample integer default 0,
  p_consecutive_losses integer default 0,
  p_drawdown_percent numeric default 0,
  p_roi numeric default null,
  p_average_clv numeric default null,
  p_pause_minutes integer default 0,
  p_pause_reason text default null,
  p_last_brief jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('success', 'error', 'deferred', 'paused') then
    raise exception 'Unsupported autonomous agent V2 status';
  end if;
  if p_health_status not in ('healthy', 'learning', 'watch', 'paused', 'blocked') then
    raise exception 'Unsupported autonomous agent V2 health status';
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
      health_status = p_health_status,
      health_score = greatest(0, least(100, coalesce(p_health_score, 0))),
      resolved_sample = greatest(0, coalesce(p_resolved_sample, 0)),
      consecutive_losses = greatest(0, coalesce(p_consecutive_losses, 0)),
      drawdown_percent = greatest(0, coalesce(p_drawdown_percent, 0)),
      roi = p_roi,
      average_clv = p_average_clv,
      pause_reason = nullif(left(coalesce(p_pause_reason, ''), 500), ''),
      paused_until = case
        when greatest(0, coalesce(p_pause_minutes, 0)) > 0
          then now() + make_interval(mins => greatest(1, least(p_pause_minutes, 10080)))
        else null
      end,
      last_brief = coalesce(p_last_brief, '{}'::jsonb),
      next_check_at = now() + make_interval(mins => greatest(15, least(coalesce(p_next_check_minutes, 180), 10080)))
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
  if exists (
    select 1 from public.autonomous_agent_state
    where user_id = v_user_id and paused_until > now()
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

alter table public.autonomous_agent_decision_audit enable row level security;
alter table public.autonomous_agent_decision_audit force row level security;
alter table public.autonomous_agent_daily_briefs enable row level security;
alter table public.autonomous_agent_daily_briefs force row level security;

drop policy if exists "Users read own autonomous agent decision audit" on public.autonomous_agent_decision_audit;
create policy "Users read own autonomous agent decision audit"
on public.autonomous_agent_decision_audit for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own autonomous agent daily briefs" on public.autonomous_agent_daily_briefs;
create policy "Users read own autonomous agent daily briefs"
on public.autonomous_agent_daily_briefs for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.autonomous_agent_decision_audit from anon;
revoke all on public.autonomous_agent_daily_briefs from anon;
revoke insert, update, delete on public.autonomous_agent_decision_audit from authenticated;
revoke insert, update, delete on public.autonomous_agent_daily_briefs from authenticated;
grant select on public.autonomous_agent_decision_audit to authenticated;
grant select on public.autonomous_agent_daily_briefs to authenticated;
grant select, insert, update, delete on public.autonomous_agent_decision_audit to service_role;
grant select, insert, update, delete on public.autonomous_agent_daily_briefs to service_role;

revoke all on function public.complete_autonomous_agent_user_v2(
  uuid, text, uuid, integer, integer, integer, integer, numeric, text,
  integer, text, numeric, integer, integer, numeric, numeric, numeric,
  integer, text, jsonb
) from public;
grant execute on function public.complete_autonomous_agent_user_v2(
  uuid, text, uuid, integer, integer, integer, integer, numeric, text,
  integer, text, numeric, integer, integer, numeric, numeric, numeric,
  integer, text, jsonb
) to service_role;
