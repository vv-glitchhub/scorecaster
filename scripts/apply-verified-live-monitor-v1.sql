-- Scorecaster Verified Live Monitor V1 production patch
-- Safe to run more than once in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

create table if not exists public.live_monitor_runs_v1 (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running', 'success', 'partial', 'failed', 'disabled')),
  event_count integer not null default 0 check (event_count >= 0),
  received_count integer not null default 0 check (received_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  alert_count integer not null default 0 check (alert_count >= 0),
  source_status jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create table if not exists public.live_event_snapshots_v1 (
  id text primary key,
  run_id uuid references public.live_monitor_runs_v1(id) on delete set null,
  event_id text not null,
  sport text not null,
  league text,
  market text not null default 'h2h',
  provider_id text not null,
  source_id text not null,
  status text not null check (status in ('scheduled', 'live', 'paused', 'suspended', 'final', 'postponed', 'cancelled')),
  period integer,
  clock_seconds integer,
  clock_direction text not null default 'unknown' check (clock_direction in ('up', 'down', 'unknown')),
  home_team text,
  away_team text,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  commence_time timestamptz,
  observed_at timestamptz not null,
  provider_updated_at timestamptz not null,
  captured_at timestamptz not null,
  correction boolean not null default false,
  correction_reason text,
  supersedes_id text references public.live_event_snapshots_v1(id) on delete set null,
  metrics jsonb not null default '{}'::jsonb,
  prices jsonb not null default '[]'::jsonb,
  live_probabilities jsonb not null default '{}'::jsonb,
  live_model_version text,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  constraint live_event_snapshots_v1_provider_observed_unique unique (event_id, provider_id, observed_at),
  constraint live_event_snapshots_v1_correction_reason check (not correction or correction_reason is not null)
);

create table if not exists public.live_monitor_preferences_v1 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  alerts_enabled boolean not null default true,
  quiet_start time,
  quiet_end time,
  max_alerts_per_hour integer not null default 3 check (max_alerts_per_hour between 0 and 6),
  minimum_probability_move numeric not null default 0.05 check (minimum_probability_move between 0.01 and 0.25),
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_monitor_alerts_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watchlist_id uuid references public.watchlist_items(id) on delete cascade,
  event_id text not null,
  fingerprint text not null,
  alert_type text not null,
  severity text not null check (severity in ('info', 'medium', 'high')),
  title text not null,
  message text not null,
  evidence jsonb not null,
  active boolean not null default true,
  read_at timestamptz,
  resolved_at timestamptz,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_monitor_alerts_v1_user_fingerprint_unique unique (user_id, fingerprint)
);

create index if not exists live_event_snapshots_v1_event_time_idx
  on public.live_event_snapshots_v1(event_id, observed_at asc);
create index if not exists live_event_snapshots_v1_provider_time_idx
  on public.live_event_snapshots_v1(provider_id, provider_updated_at desc);
create index if not exists live_monitor_alerts_v1_user_time_idx
  on public.live_monitor_alerts_v1(user_id, last_seen_at desc);
create index if not exists live_monitor_alerts_v1_event_idx
  on public.live_monitor_alerts_v1(event_id, last_seen_at desc);

create or replace function public.live_monitor_set_updated_at_v1()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.live_monitor_set_updated_at_v1() from public, anon, authenticated;

drop trigger if exists live_monitor_preferences_v1_updated_at on public.live_monitor_preferences_v1;
create trigger live_monitor_preferences_v1_updated_at
before update on public.live_monitor_preferences_v1
for each row execute function public.live_monitor_set_updated_at_v1();

drop trigger if exists live_monitor_alerts_v1_updated_at on public.live_monitor_alerts_v1;
create trigger live_monitor_alerts_v1_updated_at
before update on public.live_monitor_alerts_v1
for each row execute function public.live_monitor_set_updated_at_v1();

alter table public.live_monitor_runs_v1 enable row level security;
alter table public.live_monitor_runs_v1 force row level security;
alter table public.live_event_snapshots_v1 enable row level security;
alter table public.live_event_snapshots_v1 force row level security;
alter table public.live_monitor_preferences_v1 enable row level security;
alter table public.live_monitor_preferences_v1 force row level security;
alter table public.live_monitor_alerts_v1 enable row level security;
alter table public.live_monitor_alerts_v1 force row level security;

drop policy if exists "Users read own live monitor preferences" on public.live_monitor_preferences_v1;
create policy "Users read own live monitor preferences" on public.live_monitor_preferences_v1
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own live monitor preferences" on public.live_monitor_preferences_v1;
create policy "Users insert own live monitor preferences" on public.live_monitor_preferences_v1
for insert to authenticated with check (auth.uid() = user_id and paper_only = true);
drop policy if exists "Users update own live monitor preferences" on public.live_monitor_preferences_v1;
create policy "Users update own live monitor preferences" on public.live_monitor_preferences_v1
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and paper_only = true);
drop policy if exists "Users delete own live monitor preferences" on public.live_monitor_preferences_v1;
create policy "Users delete own live monitor preferences" on public.live_monitor_preferences_v1
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users read own live monitor alerts" on public.live_monitor_alerts_v1;
create policy "Users read own live monitor alerts" on public.live_monitor_alerts_v1
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users update own live monitor alerts" on public.live_monitor_alerts_v1;
create policy "Users update own live monitor alerts" on public.live_monitor_alerts_v1
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and paper_only = true);
drop policy if exists "Users delete own live monitor alerts" on public.live_monitor_alerts_v1;
create policy "Users delete own live monitor alerts" on public.live_monitor_alerts_v1
for delete to authenticated using (auth.uid() = user_id);

revoke all privileges on table public.live_monitor_runs_v1 from public, anon, authenticated;
revoke all privileges on table public.live_event_snapshots_v1 from public, anon, authenticated;
revoke all privileges on table public.live_monitor_preferences_v1 from public, anon;
revoke all privileges on table public.live_monitor_alerts_v1 from public, anon, authenticated;
grant select, insert, update, delete on table public.live_monitor_preferences_v1 to authenticated;
grant select, update, delete on table public.live_monitor_alerts_v1 to authenticated;
grant all privileges on table public.live_monitor_runs_v1 to service_role;
grant all privileges on table public.live_event_snapshots_v1 to service_role;
grant all privileges on table public.live_monitor_preferences_v1 to service_role;
grant all privileges on table public.live_monitor_alerts_v1 to service_role;

comment on table public.live_event_snapshots_v1 is 'Immutable normalized live event evidence. Raw provider payloads and API keys are never stored.';
comment on column public.live_event_snapshots_v1.live_probabilities is 'Live-only provider probability evidence, separated from every pre-match audit and feature set.';
comment on table public.live_monitor_alerts_v1 is 'Informational paper-only alerts linked to timestamped live evidence. No real-money instruction or execution.';

commit;

notify pgrst, 'reload schema';
