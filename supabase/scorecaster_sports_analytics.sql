-- Scorecaster Sports Analytics Expansion V1
-- Shared, non-personal event analytics observations and visual snapshots.
-- Run after scorecaster_unified_data.sql and before settlement/autonomous migrations.
-- Safe to run more than once.

create table if not exists public.sports_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  sport_key text not null,
  canonical_sport text not null,
  league text,
  match text,
  commence_time timestamptz,
  captured_at timestamptz not null default now(),
  capture_bucket timestamptz not null,
  observation_count integer not null default 0 check (observation_count >= 0 and observation_count <= 10000),
  provider_count integer not null default 0 check (provider_count >= 0 and provider_count <= 100),
  coverage_score numeric(8,6) not null default 0 check (coverage_score >= 0 and coverage_score <= 1),
  available_metrics jsonb not null default '[]'::jsonb,
  missing_metrics jsonb not null default '[]'::jsonb,
  family_coverage jsonb not null default '[]'::jsonb,
  provider_status jsonb not null default '{}'::jsonb,
  golf_profile jsonb not null default '[]'::jsonb,
  raw_summary jsonb not null default '{}'::jsonb,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, capture_bucket)
);

create table if not exists public.sports_analytics_observations (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  snapshot_id uuid not null references public.sports_analytics_snapshots(id) on delete cascade,
  event_id text not null,
  sport_key text not null,
  canonical_sport text not null,
  league text,
  participant_id text,
  family text not null check (family in ('identity','market','result','event','tracking','player','team','availability','workload','environment','officiating','tactical','expected','counterfactual','quality')),
  metric text not null,
  value numeric,
  unit text,
  observed_at timestamptz not null,
  captured_at timestamptz not null default now(),
  provider text not null,
  source_trust numeric(8,6) not null default 0 check (source_trust >= 0 and source_trust <= 1),
  confidence numeric(8,6) not null default 0 check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create index if not exists sports_analytics_snapshots_captured_idx
  on public.sports_analytics_snapshots (captured_at desc);
create index if not exists sports_analytics_snapshots_sport_idx
  on public.sports_analytics_snapshots (canonical_sport, captured_at desc);
create index if not exists sports_analytics_snapshots_event_idx
  on public.sports_analytics_snapshots (event_id, captured_at desc);
create index if not exists sports_analytics_observations_event_idx
  on public.sports_analytics_observations (event_id, captured_at desc);
create index if not exists sports_analytics_observations_sport_family_idx
  on public.sports_analytics_observations (canonical_sport, family, captured_at desc);
create index if not exists sports_analytics_observations_metric_idx
  on public.sports_analytics_observations (metric, captured_at desc);
create index if not exists sports_analytics_observations_provider_idx
  on public.sports_analytics_observations (provider, captured_at desc);

alter table public.sports_analytics_snapshots enable row level security;
alter table public.sports_analytics_snapshots force row level security;
alter table public.sports_analytics_observations enable row level security;
alter table public.sports_analytics_observations force row level security;

revoke all on public.sports_analytics_snapshots from anon, authenticated;
revoke all on public.sports_analytics_observations from anon, authenticated;

grant select, insert, update, delete on public.sports_analytics_snapshots to service_role;
grant select, insert, update, delete on public.sports_analytics_observations to service_role;

-- Public and authenticated clients use the sanitized server API. Direct table access stays disabled.
