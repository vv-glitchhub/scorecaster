-- Scorecaster Self-Building Data Engine V1
-- Immutable point-in-time feature snapshots + autonomous paper-decision ledger.
-- Server/service-role only. No real-money execution.

create table if not exists public.scorecaster_data_engine_runs_v1 (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','success','partial','failed')),
  trigger_type text not null default 'scheduled' check (trigger_type in ('scheduled','manual','backfill','test')),
  collector_run_id uuid,
  events_seen integer not null default 0 check (events_seen between 0 and 100000),
  feature_snapshots integer not null default 0 check (feature_snapshots between 0 and 100000),
  decisions_written integer not null default 0 check (decisions_written between 0 and 100000),
  source_status jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create table if not exists public.scorecaster_pit_feature_snapshots_v1 (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.scorecaster_data_engine_runs_v1(id) on delete set null,
  event_id text not null,
  sport_key text not null,
  league text,
  home_team text,
  away_team text,
  commence_time timestamptz,
  as_of timestamptz not null,
  as_of_bucket timestamptz not null,
  feature_schema_version text not null default 'scorecaster-pit-features-v1',
  input_hash text not null,
  features jsonb not null default '{}'::jsonb,
  source_lineage jsonb not null default '[]'::jsonb,
  data_quality jsonb not null default '{}'::jsonb,
  eligible_for_model boolean not null default false,
  leakage_guard_passed boolean not null default false,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  unique (event_id, as_of_bucket, feature_schema_version)
);

create table if not exists public.scorecaster_autonomous_decisions_v1 (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.scorecaster_data_engine_runs_v1(id) on delete set null,
  feature_snapshot_id uuid not null references public.scorecaster_pit_feature_snapshots_v1(id) on delete restrict,
  event_id text not null,
  as_of timestamptz not null,
  decision text not null check (decision in ('PLAY','CAUTION','SKIP')),
  selection text,
  model_probability numeric,
  market_probability numeric,
  edge numeric,
  ev numeric,
  confidence numeric,
  score numeric,
  model_stack jsonb not null default '{}'::jsonb,
  evidence_readiness jsonb not null default '{}'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  decision_hash text not null unique,
  source_decision_version text,
  automatic_upgrade_by_self_data_layer boolean not null default false check (automatic_upgrade_by_self_data_layer = false),
  production_probability_changed boolean not null default false check (production_probability_changed = false),
  real_money_action_available boolean not null default false check (real_money_action_available = false),
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create index if not exists scorecaster_data_engine_runs_v1_started_idx
  on public.scorecaster_data_engine_runs_v1 (started_at desc);
create index if not exists scorecaster_pit_feature_snapshots_v1_event_idx
  on public.scorecaster_pit_feature_snapshots_v1 (event_id, as_of desc);
create index if not exists scorecaster_pit_feature_snapshots_v1_eligible_idx
  on public.scorecaster_pit_feature_snapshots_v1 (eligible_for_model, as_of desc);
create index if not exists scorecaster_autonomous_decisions_v1_event_idx
  on public.scorecaster_autonomous_decisions_v1 (event_id, as_of desc);
create index if not exists scorecaster_autonomous_decisions_v1_decision_idx
  on public.scorecaster_autonomous_decisions_v1 (decision, as_of desc);

alter table public.scorecaster_data_engine_runs_v1 enable row level security;
alter table public.scorecaster_data_engine_runs_v1 force row level security;
alter table public.scorecaster_pit_feature_snapshots_v1 enable row level security;
alter table public.scorecaster_pit_feature_snapshots_v1 force row level security;
alter table public.scorecaster_autonomous_decisions_v1 enable row level security;
alter table public.scorecaster_autonomous_decisions_v1 force row level security;

revoke all on public.scorecaster_data_engine_runs_v1 from anon, authenticated;
revoke all on public.scorecaster_pit_feature_snapshots_v1 from anon, authenticated;
revoke all on public.scorecaster_autonomous_decisions_v1 from anon, authenticated;

grant select, insert, update, delete on public.scorecaster_data_engine_runs_v1 to service_role;
grant select, insert, update, delete on public.scorecaster_pit_feature_snapshots_v1 to service_role;
grant select, insert, update, delete on public.scorecaster_autonomous_decisions_v1 to service_role;
