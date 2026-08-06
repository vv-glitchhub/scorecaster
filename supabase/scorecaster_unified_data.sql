-- Scorecaster Unified Sports Data V2
-- Shared, non-personal event data history, provider observations, closing lines and incidents.
-- Run after Decision Diagnostics and before settlement/autonomous-agent migrations.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.unified_data_snapshots (
  id uuid primary key default gen_random_uuid(),
  capture_bucket timestamptz not null,
  captured_at timestamptz not null default now(),
  event_id text not null,
  sport_key text,
  league text,
  commence_time timestamptz,
  home_team text,
  away_team text,
  selection text not null,
  decision text not null default 'CAUTION',
  odds numeric,
  market_probability numeric,
  provider_count integer not null default 0,
  provider_disagreement numeric,
  coverage_score numeric not null default 0,
  used_factor_count integer not null default 0,
  total_context_impact numeric not null default 0,
  safety_action text not null default 'retain',
  missing_families text[] not null default '{}',
  factor_statuses jsonb not null default '{}'::jsonb,
  provider_summary jsonb not null default '{}'::jsonb,
  ledger jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.unified_data_snapshots add column if not exists provider_disagreement numeric;
alter table public.unified_data_snapshots add column if not exists missing_families text[] not null default '{}';
alter table public.unified_data_snapshots add column if not exists factor_statuses jsonb not null default '{}'::jsonb;
alter table public.unified_data_snapshots add column if not exists provider_summary jsonb not null default '{}'::jsonb;
alter table public.unified_data_snapshots add column if not exists ledger jsonb not null default '{}'::jsonb;

create unique index if not exists idx_unified_data_snapshot_event_selection_bucket
  on public.unified_data_snapshots(event_id, selection, capture_bucket);
create index if not exists idx_unified_data_snapshot_event_time
  on public.unified_data_snapshots(event_id, captured_at desc);
create index if not exists idx_unified_data_snapshot_commence
  on public.unified_data_snapshots(commence_time, captured_at desc);
create index if not exists idx_unified_data_snapshot_quality
  on public.unified_data_snapshots(coverage_score, provider_disagreement, captured_at desc);

alter table public.unified_data_snapshots drop constraint if exists unified_data_snapshot_decision_allowed;
alter table public.unified_data_snapshots add constraint unified_data_snapshot_decision_allowed
  check (decision in ('PLAY', 'CAUTION', 'SKIP')) not valid;
alter table public.unified_data_snapshots drop constraint if exists unified_data_snapshot_safety_action_allowed;
alter table public.unified_data_snapshots add constraint unified_data_snapshot_safety_action_allowed
  check (safety_action in ('retain', 'downgrade', 'blocked')) not valid;

create table if not exists public.unified_data_provider_observations (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references public.unified_data_snapshots(id) on delete cascade,
  event_id text not null,
  selection text not null,
  provider_key text not null,
  family text not null,
  mode text not null default 'unknown',
  ok boolean not null default false,
  trust numeric,
  confidence numeric,
  observed_at timestamptz,
  age_hours numeric,
  divergence_from_primary numeric,
  details jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create unique index if not exists idx_unified_data_provider_observation_unique
  on public.unified_data_provider_observations(snapshot_id, provider_key, family);
create index if not exists idx_unified_data_provider_observation_health
  on public.unified_data_provider_observations(provider_key, ok, captured_at desc);
create index if not exists idx_unified_data_provider_observation_event
  on public.unified_data_provider_observations(event_id, captured_at desc);

create table if not exists public.unified_data_closing_records (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  selection text not null,
  sport_key text,
  league text,
  commence_time timestamptz not null,
  opening_odds numeric,
  opening_captured_at timestamptz,
  closing_odds numeric not null,
  closing_captured_at timestamptz not null,
  price_clv numeric,
  opening_snapshot_id uuid references public.unified_data_snapshots(id) on delete set null,
  closing_snapshot_id uuid references public.unified_data_snapshots(id) on delete set null,
  source text not null default 'scorecaster-prestart-snapshot',
  finalized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_unified_data_closing_event_selection
  on public.unified_data_closing_records(event_id, selection);
create index if not exists idx_unified_data_closing_commence
  on public.unified_data_closing_records(commence_time desc);

create table if not exists public.unified_data_incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  incident_type text not null,
  severity text not null default 'info',
  title text not null,
  message text not null,
  event_id text,
  provider_key text,
  details jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_unified_data_incident_fingerprint
  on public.unified_data_incidents(fingerprint);
create index if not exists idx_unified_data_incident_active
  on public.unified_data_incidents(active, severity, last_seen_at desc);
create index if not exists idx_unified_data_incident_event
  on public.unified_data_incidents(event_id, active, last_seen_at desc);

alter table public.unified_data_incidents drop constraint if exists unified_data_incident_severity_allowed;
alter table public.unified_data_incidents add constraint unified_data_incident_severity_allowed
  check (severity in ('high', 'medium', 'info')) not valid;

create or replace function public.set_unified_data_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists unified_data_closing_set_updated_at on public.unified_data_closing_records;
create trigger unified_data_closing_set_updated_at
before update on public.unified_data_closing_records
for each row execute function public.set_unified_data_updated_at();

drop trigger if exists unified_data_incident_set_updated_at on public.unified_data_incidents;
create trigger unified_data_incident_set_updated_at
before update on public.unified_data_incidents
for each row execute function public.set_unified_data_updated_at();

alter table public.unified_data_snapshots enable row level security;
alter table public.unified_data_snapshots force row level security;
alter table public.unified_data_provider_observations enable row level security;
alter table public.unified_data_provider_observations force row level security;
alter table public.unified_data_closing_records enable row level security;
alter table public.unified_data_closing_records force row level security;
alter table public.unified_data_incidents enable row level security;
alter table public.unified_data_incidents force row level security;

-- These tables contain shared operational sports data only, never user bets or identity data.
drop policy if exists "Authenticated users read unified snapshots" on public.unified_data_snapshots;
create policy "Authenticated users read unified snapshots"
on public.unified_data_snapshots for select to authenticated using (true);

drop policy if exists "Authenticated users read unified provider observations" on public.unified_data_provider_observations;
create policy "Authenticated users read unified provider observations"
on public.unified_data_provider_observations for select to authenticated using (true);

drop policy if exists "Authenticated users read unified closing records" on public.unified_data_closing_records;
create policy "Authenticated users read unified closing records"
on public.unified_data_closing_records for select to authenticated using (true);

drop policy if exists "Authenticated users read unified incidents" on public.unified_data_incidents;
create policy "Authenticated users read unified incidents"
on public.unified_data_incidents for select to authenticated using (true);

revoke all on public.unified_data_snapshots from anon;
revoke all on public.unified_data_provider_observations from anon;
revoke all on public.unified_data_closing_records from anon;
revoke all on public.unified_data_incidents from anon;
revoke all on public.unified_data_snapshots from public;
revoke all on public.unified_data_provider_observations from public;
revoke all on public.unified_data_closing_records from public;
revoke all on public.unified_data_incidents from public;
revoke insert, update, delete, truncate, references, trigger on public.unified_data_snapshots from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.unified_data_provider_observations from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.unified_data_closing_records from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.unified_data_incidents from authenticated;
grant select on public.unified_data_snapshots to authenticated;
grant select on public.unified_data_provider_observations to authenticated;
grant select on public.unified_data_closing_records to authenticated;
grant select on public.unified_data_incidents to authenticated;
grant select, insert, update, delete on public.unified_data_snapshots to service_role;
grant select, insert, update, delete on public.unified_data_provider_observations to service_role;
grant select, insert, update, delete on public.unified_data_closing_records to service_role;
grant select, insert, update, delete on public.unified_data_incidents to service_role;

-- Writes are intentionally reserved for the service-role capture worker.