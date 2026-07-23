-- Scorecaster Autonomous Intelligence V12
-- Run before scorecaster_autonomous_agent.sql in the reviewed migration sequence.
-- Safe to run more than once. All execution remains virtual paper-only.

create extension if not exists pgcrypto;

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

create table if not exists public.autonomous_agent_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_check_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_status text not null default 'idle',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.autonomous_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'running',
  sports text[] not null default '{}'::text[],
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.autonomous_agent_settings add column if not exists autonomy_profile text not null default 'conservative';
alter table public.autonomous_agent_settings add column if not exists learning_enabled boolean not null default true;
alter table public.autonomous_agent_settings add column if not exists auto_paper_promotion boolean not null default true;
alter table public.autonomous_agent_settings add column if not exists max_consecutive_losses integer not null default 6;
alter table public.autonomous_agent_settings add column if not exists max_drawdown_percent numeric not null default 12;
alter table public.autonomous_agent_settings add column if not exists minimum_provider_health numeric not null default 60;

alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_v12_profile_allowed;
alter table public.autonomous_agent_settings add constraint autonomous_agent_v12_profile_allowed
  check (autonomy_profile in ('conservative', 'balanced', 'research')) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_v12_loss_limit;
alter table public.autonomous_agent_settings add constraint autonomous_agent_v12_loss_limit
  check (max_consecutive_losses between 3 and 20) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_v12_drawdown_limit;
alter table public.autonomous_agent_settings add constraint autonomous_agent_v12_drawdown_limit
  check (max_drawdown_percent between 3 and 30) not valid;
alter table public.autonomous_agent_settings drop constraint if exists autonomous_agent_v12_provider_gate;
alter table public.autonomous_agent_settings add constraint autonomous_agent_v12_provider_gate
  check (minimum_provider_health between 30 and 90) not valid;

alter table public.autonomous_agent_state add column if not exists operating_mode text not null default 'learning';
alter table public.autonomous_agent_state add column if not exists health_score numeric not null default 50;
alter table public.autonomous_agent_state add column if not exists kill_switch_active boolean not null default false;
alter table public.autonomous_agent_state add column if not exists kill_switch_reason text;
alter table public.autonomous_agent_state add column if not exists next_interval_minutes integer not null default 180;
alter table public.autonomous_agent_state add column if not exists champion_model_key text not null default 'identity';
alter table public.autonomous_agent_state add column if not exists challenger_model_key text not null default 'identity';
alter table public.autonomous_agent_state add column if not exists promotion_ready_streak integer not null default 0;
alter table public.autonomous_agent_state add column if not exists last_learning_at timestamptz;

alter table public.autonomous_agent_state drop constraint if exists autonomous_agent_v12_mode_allowed;
alter table public.autonomous_agent_state add constraint autonomous_agent_v12_mode_allowed
  check (operating_mode in ('learning', 'active', 'cautious', 'recovery', 'frozen')) not valid;
alter table public.autonomous_agent_state drop constraint if exists autonomous_agent_v12_health_range;
alter table public.autonomous_agent_state add constraint autonomous_agent_v12_health_range
  check (health_score between 0 and 100) not valid;
alter table public.autonomous_agent_state drop constraint if exists autonomous_agent_v12_interval_range;
alter table public.autonomous_agent_state add constraint autonomous_agent_v12_interval_range
  check (next_interval_minutes between 30 and 1440) not valid;

alter table public.autonomous_agent_runs add column if not exists operating_mode text;
alter table public.autonomous_agent_runs add column if not exists health_score numeric;
alter table public.autonomous_agent_runs add column if not exists learning_snapshot jsonb not null default '{}'::jsonb;
alter table public.autonomous_agent_runs add column if not exists incident_count integer not null default 0;

create table if not exists public.autonomous_agent_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_key text not null,
  model_type text not null default 'calibrator',
  parameters jsonb not null default '{}'::jsonb,
  status text not null default 'challenger',
  sample_size integer not null default 0,
  train_metrics jsonb not null default '{}'::jsonb,
  holdout_metrics jsonb not null default '{}'::jsonb,
  promotion_evidence jsonb not null default '{}'::jsonb,
  probability_applied_to_published_model boolean not null default false,
  paper_risk_policy_only boolean not null default true,
  promoted_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, model_key)
);

create table if not exists public.autonomous_agent_learning_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operating_mode text not null,
  health_score numeric not null,
  sample_size integer not null default 0,
  champion_model_key text not null default 'identity',
  challenger_model_key text not null default 'identity',
  promotion_action text not null default 'KEEP_CHALLENGER_SHADOW',
  performance jsonb not null default '{}'::jsonb,
  provider_health jsonb not null default '{}'::jsonb,
  model_lab jsonb not null default '{}'::jsonb,
  control_plane jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.autonomous_agent_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  incident_type text not null,
  severity text not null default 'medium',
  title text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

alter table public.autonomous_agent_models drop constraint if exists autonomous_agent_model_status_allowed;
alter table public.autonomous_agent_models add constraint autonomous_agent_model_status_allowed
  check (status in ('champion', 'challenger', 'retired', 'rejected')) not valid;
alter table public.autonomous_agent_models drop constraint if exists autonomous_agent_model_published_probability_blocked;
alter table public.autonomous_agent_models add constraint autonomous_agent_model_published_probability_blocked
  check (probability_applied_to_published_model = false and paper_risk_policy_only = true) not valid;
alter table public.autonomous_agent_learning_snapshots drop constraint if exists autonomous_agent_learning_health_range;
alter table public.autonomous_agent_learning_snapshots add constraint autonomous_agent_learning_health_range
  check (health_score between 0 and 100 and sample_size >= 0) not valid;
alter table public.autonomous_agent_incidents drop constraint if exists autonomous_agent_incident_severity_allowed;
alter table public.autonomous_agent_incidents add constraint autonomous_agent_incident_severity_allowed
  check (severity in ('high', 'medium', 'info')) not valid;

create index if not exists idx_autonomous_models_user_status
  on public.autonomous_agent_models(user_id, status, updated_at desc);
create index if not exists idx_autonomous_learning_user_captured
  on public.autonomous_agent_learning_snapshots(user_id, captured_at desc);
create index if not exists idx_autonomous_incidents_user_active
  on public.autonomous_agent_incidents(user_id, active, severity, last_seen_at desc);

create or replace function public.set_autonomous_v12_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists autonomous_agent_models_set_updated_at on public.autonomous_agent_models;
create trigger autonomous_agent_models_set_updated_at
before update on public.autonomous_agent_models
for each row execute function public.set_autonomous_v12_updated_at();

drop trigger if exists autonomous_agent_incidents_set_updated_at on public.autonomous_agent_incidents;
create trigger autonomous_agent_incidents_set_updated_at
before update on public.autonomous_agent_incidents
for each row execute function public.set_autonomous_v12_updated_at();

create or replace function public.schedule_autonomous_agent_v12_for_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.enabled then
    insert into public.autonomous_agent_state (user_id, next_check_at, last_status, operating_mode)
    values (new.user_id, now(), 'idle', 'learning')
    on conflict (user_id) do update
      set next_check_at = least(public.autonomous_agent_state.next_check_at, now()),
          kill_switch_active = false,
          kill_switch_reason = null;
  end if;
  return new;
end;
$$;

drop trigger if exists autonomous_agent_v12_settings_schedule on public.autonomous_agent_settings;
create trigger autonomous_agent_v12_settings_schedule
after insert or update of autonomy_profile, learning_enabled, auto_paper_promotion,
  max_consecutive_losses, max_drawdown_percent, minimum_provider_health
on public.autonomous_agent_settings
for each row execute function public.schedule_autonomous_agent_v12_for_user();

create or replace function public.complete_autonomous_agent_user_v12(
  p_user_id uuid,
  p_status text,
  p_run_id uuid default null,
  p_candidate_count integer default 0,
  p_selected_count integer default 0,
  p_saved_count integer default 0,
  p_skipped_count integer default 0,
  p_total_stake numeric default 0,
  p_error text default null,
  p_operating_mode text default 'learning',
  p_health_score numeric default 50,
  p_kill_switch_active boolean default false,
  p_kill_switch_reason text default null,
  p_next_check_minutes integer default 180,
  p_champion_model_key text default 'identity',
  p_challenger_model_key text default 'identity',
  p_promotion_ready_streak integer default 0
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
  if p_operating_mode not in ('learning', 'active', 'cautious', 'recovery', 'frozen') then
    raise exception 'Unsupported autonomous operating mode';
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
      operating_mode = p_operating_mode,
      health_score = greatest(0, least(100, coalesce(p_health_score, 50))),
      kill_switch_active = coalesce(p_kill_switch_active, false),
      kill_switch_reason = nullif(left(coalesce(p_kill_switch_reason, ''), 500), ''),
      next_interval_minutes = greatest(30, least(1440, coalesce(p_next_check_minutes, 180))),
      next_check_at = now() + make_interval(mins => greatest(30, least(1440, coalesce(p_next_check_minutes, 180)))),
      champion_model_key = left(coalesce(nullif(p_champion_model_key, ''), 'identity'), 120),
      challenger_model_key = left(coalesce(nullif(p_challenger_model_key, ''), 'identity'), 120),
      promotion_ready_streak = greatest(0, least(100, coalesce(p_promotion_ready_streak, 0))),
      last_learning_at = now()
  where user_id = p_user_id;
end;
$$;

alter table public.autonomous_agent_models enable row level security;
alter table public.autonomous_agent_models force row level security;
alter table public.autonomous_agent_learning_snapshots enable row level security;
alter table public.autonomous_agent_learning_snapshots force row level security;
alter table public.autonomous_agent_incidents enable row level security;
alter table public.autonomous_agent_incidents force row level security;

drop policy if exists "Users read own autonomous models" on public.autonomous_agent_models;
create policy "Users read own autonomous models" on public.autonomous_agent_models
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users read own autonomous learning" on public.autonomous_agent_learning_snapshots;
create policy "Users read own autonomous learning" on public.autonomous_agent_learning_snapshots
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users read own autonomous incidents" on public.autonomous_agent_incidents;
create policy "Users read own autonomous incidents" on public.autonomous_agent_incidents
for select to authenticated using (auth.uid() = user_id);

revoke all on public.autonomous_agent_models from anon, authenticated;
revoke all on public.autonomous_agent_learning_snapshots from anon, authenticated;
revoke all on public.autonomous_agent_incidents from anon, authenticated;
grant select on public.autonomous_agent_models to authenticated;
grant select on public.autonomous_agent_learning_snapshots to authenticated;
grant select on public.autonomous_agent_incidents to authenticated;
grant select, insert, update, delete on public.autonomous_agent_models to service_role;
grant select, insert, update, delete on public.autonomous_agent_learning_snapshots to service_role;
grant select, insert, update, delete on public.autonomous_agent_incidents to service_role;

revoke all on function public.complete_autonomous_agent_user_v12(uuid, text, uuid, integer, integer, integer, integer, numeric, text, text, numeric, boolean, text, integer, text, text, integer) from public;
grant execute on function public.complete_autonomous_agent_user_v12(uuid, text, uuid, integer, integer, integer, integer, numeric, text, text, numeric, boolean, text, integer, text, text, integer) to service_role;
