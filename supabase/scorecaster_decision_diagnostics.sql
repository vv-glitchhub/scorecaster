-- Scorecaster Decision Diagnostics V2
-- Global, non-personal operational history for decision flow and provider health.
-- Run after the core Scorecaster schema. Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.decision_diagnostic_snapshots (
  id uuid primary key default gen_random_uuid(),
  capture_bucket timestamptz not null,
  captured_at timestamptz not null default now(),
  source text,
  fixture_source text,
  league_selection_mode text,
  default_league_season text,
  selected_leagues text[] not null default '{}',
  status text not null default 'empty',
  total integer not null default 0,
  play_count integer not null default 0,
  caution_count integer not null default 0,
  skip_count integer not null default 0,
  stale_rate numeric not null default 0,
  average_bookmakers numeric,
  average_confidence numeric,
  average_age_hours numeric,
  reasons jsonb not null default '[]'::jsonb,
  leagues jsonb not null default '[]'::jsonb,
  provider_health jsonb not null default '{}'::jsonb,
  thresholds jsonb not null default '{}'::jsonb,
  picks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.decision_diagnostic_snapshots add column if not exists capture_bucket timestamptz;
alter table public.decision_diagnostic_snapshots add column if not exists provider_health jsonb not null default '{}'::jsonb;
alter table public.decision_diagnostic_snapshots add column if not exists thresholds jsonb not null default '{}'::jsonb;
alter table public.decision_diagnostic_snapshots add column if not exists picks jsonb not null default '[]'::jsonb;

create unique index if not exists idx_decision_diagnostic_snapshots_bucket
  on public.decision_diagnostic_snapshots(capture_bucket);
create index if not exists idx_decision_diagnostic_snapshots_captured
  on public.decision_diagnostic_snapshots(captured_at desc);
create index if not exists idx_decision_diagnostic_snapshots_status
  on public.decision_diagnostic_snapshots(status, captured_at desc);

alter table public.decision_diagnostic_snapshots drop constraint if exists decision_diagnostic_snapshot_status_allowed;
alter table public.decision_diagnostic_snapshots add constraint decision_diagnostic_snapshot_status_allowed
  check (status in ('empty', 'blocked', 'watch', 'healthy')) not valid;

create table if not exists public.decision_diagnostic_alerts (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  alert_type text not null,
  severity text not null default 'info',
  title text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.decision_diagnostic_alerts add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.decision_diagnostic_alerts add column if not exists active boolean not null default true;
alter table public.decision_diagnostic_alerts add column if not exists resolved_at timestamptz;
alter table public.decision_diagnostic_alerts add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_decision_diagnostic_alerts_fingerprint
  on public.decision_diagnostic_alerts(fingerprint);
create index if not exists idx_decision_diagnostic_alerts_active
  on public.decision_diagnostic_alerts(active, severity, last_seen_at desc);

alter table public.decision_diagnostic_alerts drop constraint if exists decision_diagnostic_alert_severity_allowed;
alter table public.decision_diagnostic_alerts add constraint decision_diagnostic_alert_severity_allowed
  check (severity in ('high', 'medium', 'info')) not valid;

create or replace function public.set_decision_diagnostic_alert_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists decision_diagnostic_alert_set_updated_at on public.decision_diagnostic_alerts;
create trigger decision_diagnostic_alert_set_updated_at
before update on public.decision_diagnostic_alerts
for each row execute function public.set_decision_diagnostic_alert_updated_at();

alter table public.decision_diagnostic_snapshots enable row level security;
alter table public.decision_diagnostic_snapshots force row level security;
alter table public.decision_diagnostic_alerts enable row level security;
alter table public.decision_diagnostic_alerts force row level security;

-- History contains only shared operational metrics, never user bets or identity data.
drop policy if exists "Authenticated users read diagnostic snapshots" on public.decision_diagnostic_snapshots;
create policy "Authenticated users read diagnostic snapshots"
on public.decision_diagnostic_snapshots for select
to authenticated
using (true);

drop policy if exists "Authenticated users read diagnostic alerts" on public.decision_diagnostic_alerts;
create policy "Authenticated users read diagnostic alerts"
on public.decision_diagnostic_alerts for select
to authenticated
using (true);

revoke all on public.decision_diagnostic_snapshots from anon;
revoke all on public.decision_diagnostic_alerts from anon;
revoke insert, update, delete on public.decision_diagnostic_snapshots from authenticated;
revoke insert, update, delete on public.decision_diagnostic_alerts from authenticated;
grant select on public.decision_diagnostic_snapshots to authenticated;
grant select on public.decision_diagnostic_alerts to authenticated;
grant select, insert, update, delete on public.decision_diagnostic_snapshots to service_role;
grant select, insert, update, delete on public.decision_diagnostic_alerts to service_role;

-- Inserts and updates are intentionally reserved for the service-role worker.