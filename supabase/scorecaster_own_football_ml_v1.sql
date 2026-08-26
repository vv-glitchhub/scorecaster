-- Scorecaster Own Football ML V1
-- Server-only model artifacts and evaluation ledger.

create table if not exists public.scorecaster_model_artifacts_v1 (
  id uuid primary key default gen_random_uuid(),
  artifact_hash text not null unique,
  model_id text not null,
  model_version text not null,
  model_family text not null,
  feature_schema_version text not null,
  trained_at timestamptz not null,
  training_cutoff timestamptz not null,
  training_data_hash text not null,
  artifact jsonb not null,
  train_metrics jsonb not null default '{}'::jsonb,
  validation_metrics jsonb not null default '{}'::jsonb,
  holdout_metrics jsonb not null default '{}'::jsonb,
  bootstrap jsonb not null default '{}'::jsonb,
  promotion_gate jsonb not null default '{}'::jsonb,
  independent_from_market boolean not null default true,
  shadow_only boolean not null default true,
  automatic_promotion_allowed boolean not null default false,
  production_probability_changed boolean not null default false,
  paper_only boolean not null default true,
  created_at timestamptz not null default now(),
  unique(model_id, model_version)
);

create index if not exists scorecaster_model_artifacts_v1_model_idx
  on public.scorecaster_model_artifacts_v1(model_id, trained_at desc);
create index if not exists scorecaster_model_artifacts_v1_cutoff_idx
  on public.scorecaster_model_artifacts_v1(training_cutoff desc);

alter table public.scorecaster_model_artifacts_v1 enable row level security;
alter table public.scorecaster_model_artifacts_v1 force row level security;
revoke all on public.scorecaster_model_artifacts_v1 from anon, authenticated;
grant all on public.scorecaster_model_artifacts_v1 to service_role;

create table if not exists public.scorecaster_ml_training_runs_v1 (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null,
  model_id text not null,
  model_version text,
  training_rows integer not null default 0,
  validation_rows integer not null default 0,
  holdout_rows integer not null default 0,
  training_data_hash text,
  metrics jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  paper_only boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists scorecaster_ml_training_runs_v1_started_idx
  on public.scorecaster_ml_training_runs_v1(started_at desc);

alter table public.scorecaster_ml_training_runs_v1 enable row level security;
alter table public.scorecaster_ml_training_runs_v1 force row level security;
revoke all on public.scorecaster_ml_training_runs_v1 from anon, authenticated;
grant all on public.scorecaster_ml_training_runs_v1 to service_role;
