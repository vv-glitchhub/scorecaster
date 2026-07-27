-- Scorecaster Collector V1
-- Rights-aware raw/normalized sports data collection.
-- Safe to run more than once. Direct client access remains disabled.

create table if not exists public.collector_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','success','partial','failed')),
  trigger_type text not null default 'scheduled' check (trigger_type in ('scheduled','manual','backfill','import')),
  source_count integer not null default 0 check (source_count between 0 and 100),
  received_count integer not null default 0 check (received_count between 0 and 1000000),
  accepted_count integer not null default 0 check (accepted_count between 0 and 1000000),
  rejected_count integer not null default 0 check (rejected_count between 0 and 1000000),
  publishable_count integer not null default 0 check (publishable_count between 0 and 1000000),
  research_only_count integer not null default 0 check (research_only_count between 0 and 1000000),
  source_status jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create table if not exists public.collector_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.collector_runs(id) on delete set null,
  fingerprint text not null unique,
  source_id text not null,
  source_type text not null check (source_type in ('internal','api','open_dataset','manual_import')),
  license text not null,
  access_mode text not null check (access_mode in ('production','research','disabled')),
  commercial_use_allowed boolean not null default false,
  redistribution_allowed boolean not null default false,
  attribution_required boolean not null default false,
  attribution text,
  publishable boolean not null default false,
  publication_block_reason text,
  event_id text not null,
  entity_id text,
  sport text not null,
  league text,
  metric text not null,
  value numeric,
  unit text,
  observed_at timestamptz not null,
  collected_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  confidence numeric(8,6) not null default 0 check (confidence between 0 and 1),
  source_trust numeric(8,6) not null default 0 check (source_trust between 0 and 1),
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create index if not exists collector_runs_started_idx on public.collector_runs (started_at desc);
create index if not exists collector_records_collected_idx on public.collector_records (collected_at desc);
create index if not exists collector_records_event_idx on public.collector_records (event_id, observed_at desc);
create index if not exists collector_records_sport_metric_idx on public.collector_records (sport, metric, observed_at desc);
create index if not exists collector_records_source_idx on public.collector_records (source_id, collected_at desc);
create index if not exists collector_records_publishable_idx on public.collector_records (publishable, collected_at desc);

alter table public.collector_runs enable row level security;
alter table public.collector_runs force row level security;
alter table public.collector_records enable row level security;
alter table public.collector_records force row level security;

revoke all on public.collector_runs from anon, authenticated;
revoke all on public.collector_records from anon, authenticated;

grant select, insert, update, delete on public.collector_runs to service_role;
grant select, insert, update, delete on public.collector_records to service_role;

-- Sanitized server APIs expose only bounded metadata and publishable rows.
