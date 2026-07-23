-- Scorecaster Autonomous V12
-- Run after scorecaster_autonomous_agent.sql.
-- Safe to run more than once. This layer remains paper-only and can only tighten risk automatically.

create extension if not exists pgcrypto;

create table if not exists public.autonomous_agent_v12_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kill_switch boolean not null default false,
  autonomy_level text not null default 'balanced',
  max_daily_loss_percent numeric not null default 4.0,
  max_drawdown_percent numeric not null default 15.0,
  max_loss_streak integer not null default 10,
  allow_shadow_learning boolean not null default true,
  allow_automatic_risk_tightening boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.autonomous_agent_v12_controls add column if not exists kill_switch boolean not null default false;
alter table public.autonomous_agent_v12_controls add column if not exists autonomy_level text not null default 'balanced';
alter table public.autonomous_agent_v12_controls add column if not exists max_daily_loss_percent numeric not null default 4.0;
alter table public.autonomous_agent_v12_controls add column if not exists max_drawdown_percent numeric not null default 15.0;
alter table public.autonomous_agent_v12_controls add column if not exists max_loss_streak integer not null default 10;
alter table public.autonomous_agent_v12_controls add column if not exists allow_shadow_learning boolean not null default true;
alter table public.autonomous_agent_v12_controls add column if not exists allow_automatic_risk_tightening boolean not null default true;
alter table public.autonomous_agent_v12_controls add column if not exists updated_at timestamptz not null default now();

alter table public.autonomous_agent_v12_controls drop constraint if exists autonomous_v12_level_allowed;
alter table public.autonomous_agent_v12_controls add constraint autonomous_v12_level_allowed
  check (autonomy_level in ('observe', 'conservative', 'balanced')) not valid;
alter table public.autonomous_agent_v12_controls drop constraint if exists autonomous_v12_loss_range;
alter table public.autonomous_agent_v12_controls add constraint autonomous_v12_loss_range
  check (max_daily_loss_percent between 0.5 and 10 and max_drawdown_percent between 2 and 30 and max_loss_streak between 3 and 20) not valid;

create table if not exists public.autonomous_agent_v12_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  operating_state text not null default 'LEARNING',
  policy jsonb not null default '{}'::jsonb,
  circuit_breakers jsonb not null default '{}'::jsonb,
  learning_report jsonb not null default '{}'::jsonb,
  shadow_champion_id text,
  last_audit jsonb not null default '{}'::jsonb,
  last_learning_at timestamptz,
  last_decision_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.autonomous_agent_v12_state add column if not exists operating_state text not null default 'LEARNING';
alter table public.autonomous_agent_v12_state add column if not exists policy jsonb not null default '{}'::jsonb;
alter table public.autonomous_agent_v12_state add column if not exists circuit_breakers jsonb not null default '{}'::jsonb;
alter table public.autonomous_agent_v12_state add column if not exists learning_report jsonb not null default '{}'::jsonb;
alter table public.autonomous_agent_v12_state add column if not exists shadow_champion_id text;
alter table public.autonomous_agent_v12_state add column if not exists last_audit jsonb not null default '{}'::jsonb;
alter table public.autonomous_agent_v12_state add column if not exists last_learning_at timestamptz;
alter table public.autonomous_agent_v12_state add column if not exists last_decision_at timestamptz;
alter table public.autonomous_agent_v12_state add column if not exists updated_at timestamptz not null default now();

alter table public.autonomous_agent_v12_state drop constraint if exists autonomous_v12_state_allowed;
alter table public.autonomous_agent_v12_state add constraint autonomous_v12_state_allowed
  check (operating_state in ('RUNNING', 'CAUTION', 'PAUSED', 'LEARNING', 'ERROR')) not valid;

create table if not exists public.autonomous_agent_v12_learning_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'learning',
  sample_size integer not null default 0,
  clv_sample integer not null default 0,
  probability_sample integer not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  calibration jsonb not null default '{}'::jsonb,
  challenger jsonb not null default '{}'::jsonb,
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.autonomous_agent_v12_learning_cycles add column if not exists status text not null default 'learning';
alter table public.autonomous_agent_v12_learning_cycles add column if not exists sample_size integer not null default 0;
alter table public.autonomous_agent_v12_learning_cycles add column if not exists clv_sample integer not null default 0;
alter table public.autonomous_agent_v12_learning_cycles add column if not exists probability_sample integer not null default 0;
alter table public.autonomous_agent_v12_learning_cycles add column if not exists metrics jsonb not null default '{}'::jsonb;
alter table public.autonomous_agent_v12_learning_cycles add column if not exists calibration jsonb not null default '{}'::jsonb;
alter table public.autonomous_agent_v12_learning_cycles add column if not exists challenger jsonb not null default '{}'::jsonb;
alter table public.autonomous_agent_v12_learning_cycles add column if not exists policy jsonb not null default '{}'::jsonb;

create index if not exists idx_autonomous_v12_learning_user_created
  on public.autonomous_agent_v12_learning_cycles(user_id, created_at desc);

create table if not exists public.autonomous_agent_v12_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid,
  event_id text,
  selection text,
  action text not null,
  reasons text[] not null default '{}'::text[],
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.autonomous_agent_v12_audit add column if not exists run_id uuid;
alter table public.autonomous_agent_v12_audit add column if not exists event_id text;
alter table public.autonomous_agent_v12_audit add column if not exists selection text;
alter table public.autonomous_agent_v12_audit add column if not exists action text not null default 'SKIP';
alter table public.autonomous_agent_v12_audit add column if not exists reasons text[] not null default '{}'::text[];
alter table public.autonomous_agent_v12_audit add column if not exists evidence jsonb not null default '{}'::jsonb;

alter table public.autonomous_agent_v12_audit drop constraint if exists autonomous_v12_action_allowed;
alter table public.autonomous_agent_v12_audit add constraint autonomous_v12_action_allowed
  check (action in ('PLAY', 'SKIP', 'PAUSE', 'LEARN', 'ERROR')) not valid;
create index if not exists idx_autonomous_v12_audit_user_created
  on public.autonomous_agent_v12_audit(user_id, created_at desc);
create index if not exists idx_autonomous_v12_audit_event
  on public.autonomous_agent_v12_audit(event_id, created_at desc);

create or replace function public.set_autonomous_v12_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.trim_autonomous_v12_learning_cycles(
  p_user_id uuid,
  p_keep integer default 180
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer := 0;
  v_keep integer := greatest(30, least(coalesce(p_keep, 180), 365));
begin
  if p_user_id is null then
    raise exception 'Autonomous V12 retention requires a user id';
  end if;

  delete from public.autonomous_agent_v12_learning_cycles cycle
  where cycle.user_id = p_user_id
    and cycle.id in (
      select old_cycle.id
      from public.autonomous_agent_v12_learning_cycles old_cycle
      where old_cycle.user_id = p_user_id
      order by old_cycle.created_at desc, old_cycle.id desc
      offset v_keep
    );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.trim_autonomous_v12_audit_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  for v_user_id in select distinct user_id from inserted_audit_rows loop
    delete from public.autonomous_agent_v12_audit audit_row
    where audit_row.user_id = v_user_id
      and audit_row.id in (
        select old_row.id
        from public.autonomous_agent_v12_audit old_row
        where old_row.user_id = v_user_id
        order by old_row.created_at desc, old_row.id desc
        offset 5000
      );
  end loop;
  return null;
end;
$$;

drop trigger if exists autonomous_v12_controls_set_updated_at on public.autonomous_agent_v12_controls;
create trigger autonomous_v12_controls_set_updated_at
before update on public.autonomous_agent_v12_controls
for each row execute function public.set_autonomous_v12_updated_at();

drop trigger if exists autonomous_v12_state_set_updated_at on public.autonomous_agent_v12_state;
create trigger autonomous_v12_state_set_updated_at
before update on public.autonomous_agent_v12_state
for each row execute function public.set_autonomous_v12_updated_at();

drop trigger if exists autonomous_v12_audit_retention on public.autonomous_agent_v12_audit;
create trigger autonomous_v12_audit_retention
after insert on public.autonomous_agent_v12_audit
referencing new table as inserted_audit_rows
for each statement execute function public.trim_autonomous_v12_audit_after_insert();

alter table public.autonomous_agent_v12_controls enable row level security;
alter table public.autonomous_agent_v12_controls force row level security;
alter table public.autonomous_agent_v12_state enable row level security;
alter table public.autonomous_agent_v12_state force row level security;
alter table public.autonomous_agent_v12_learning_cycles enable row level security;
alter table public.autonomous_agent_v12_learning_cycles force row level security;
alter table public.autonomous_agent_v12_audit enable row level security;
alter table public.autonomous_agent_v12_audit force row level security;

drop policy if exists "Users manage own Autonomous V12 controls" on public.autonomous_agent_v12_controls;
create policy "Users manage own Autonomous V12 controls"
on public.autonomous_agent_v12_controls for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users read own Autonomous V12 state" on public.autonomous_agent_v12_state;
create policy "Users read own Autonomous V12 state"
on public.autonomous_agent_v12_state for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own Autonomous V12 learning" on public.autonomous_agent_v12_learning_cycles;
create policy "Users read own Autonomous V12 learning"
on public.autonomous_agent_v12_learning_cycles for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own Autonomous V12 audit" on public.autonomous_agent_v12_audit;
create policy "Users read own Autonomous V12 audit"
on public.autonomous_agent_v12_audit for select to authenticated
using (auth.uid() = user_id);

revoke all on public.autonomous_agent_v12_controls from anon;
revoke all on public.autonomous_agent_v12_state from anon;
revoke all on public.autonomous_agent_v12_learning_cycles from anon;
revoke all on public.autonomous_agent_v12_audit from anon;
revoke all on function public.trim_autonomous_v12_learning_cycles(uuid, integer) from public, anon, authenticated;
revoke all on function public.trim_autonomous_v12_audit_after_insert() from public, anon, authenticated;

grant select, insert, update on public.autonomous_agent_v12_controls to authenticated;
grant select on public.autonomous_agent_v12_state to authenticated;
grant select on public.autonomous_agent_v12_learning_cycles to authenticated;
grant select on public.autonomous_agent_v12_audit to authenticated;

grant select, insert, update, delete on public.autonomous_agent_v12_controls to service_role;
grant select, insert, update, delete on public.autonomous_agent_v12_state to service_role;
grant select, insert, update, delete on public.autonomous_agent_v12_learning_cycles to service_role;
grant select, insert, update, delete on public.autonomous_agent_v12_audit to service_role;
grant execute on function public.trim_autonomous_v12_learning_cycles(uuid, integer) to service_role;

-- Production probability and real-money actions are intentionally absent from this migration.
