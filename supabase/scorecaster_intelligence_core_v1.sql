-- Scorecaster Intelligence Core V1
-- Owns normalized facts, outcomes, point-in-time team state, learning examples,
-- model predictions and model registry. All tables are server-only and paper-only.

create table if not exists public.scorecaster_canonical_facts_v1 (
  id uuid primary key default gen_random_uuid(),
  fact_hash text not null unique,
  source_id text not null,
  source_record_fingerprint text,
  event_id text,
  entity_id text,
  entity_type text,
  sport_key text not null,
  league text,
  fact_family text not null,
  fact_key text not null,
  value_numeric numeric,
  value_text text,
  value_json jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  captured_at timestamptz not null,
  source_trust numeric not null default 0.5 check (source_trust >= 0 and source_trust <= 1),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  independence_class text not null default 'unknown' check (independence_class in ('independent','market','derived','unknown')),
  commercial_use_allowed boolean not null default false,
  model_training_allowed boolean not null default false,
  publishable boolean not null default false,
  source_lineage jsonb not null default '{}'::jsonb,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create index if not exists scorecaster_canonical_facts_event_time_idx
  on public.scorecaster_canonical_facts_v1 (event_id, observed_at desc);
create index if not exists scorecaster_canonical_facts_entity_time_idx
  on public.scorecaster_canonical_facts_v1 (entity_id, observed_at desc);
create index if not exists scorecaster_canonical_facts_family_time_idx
  on public.scorecaster_canonical_facts_v1 (fact_family, fact_key, observed_at desc);
create index if not exists scorecaster_canonical_facts_source_time_idx
  on public.scorecaster_canonical_facts_v1 (source_id, captured_at desc);

create table if not exists public.scorecaster_event_outcomes_v1 (
  id uuid primary key default gen_random_uuid(),
  outcome_hash text not null unique,
  event_id text not null,
  sport_key text not null,
  league text,
  home_team text,
  away_team text,
  commence_time timestamptz,
  status text not null check (status in ('scheduled','live','final','cancelled','postponed','unknown')),
  home_score numeric,
  away_score numeric,
  outcome text check (outcome is null or outcome in ('home','draw','away','push','cancelled','unknown')),
  resolved_at timestamptz,
  observed_at timestamptz not null,
  captured_at timestamptz not null,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  source_count integer not null default 1 check (source_count >= 0),
  source_ids jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  finality_verified boolean not null default false,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create index if not exists scorecaster_event_outcomes_event_time_idx
  on public.scorecaster_event_outcomes_v1 (event_id, captured_at desc);
create index if not exists scorecaster_event_outcomes_final_idx
  on public.scorecaster_event_outcomes_v1 (status, resolved_at desc);

create table if not exists public.scorecaster_team_state_snapshots_v1 (
  id uuid primary key default gen_random_uuid(),
  team_key text not null,
  sport_key text not null,
  league text,
  as_of timestamptz not null,
  as_of_bucket timestamptz not null,
  state_version text not null,
  state jsonb not null,
  history_matches integer not null default 0 check (history_matches >= 0),
  input_hash text not null,
  source_lineage jsonb not null default '[]'::jsonb,
  leakage_guard_passed boolean not null default true,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  unique (team_key, as_of_bucket, state_version)
);

create index if not exists scorecaster_team_state_team_time_idx
  on public.scorecaster_team_state_snapshots_v1 (team_key, as_of desc);

create table if not exists public.scorecaster_learning_examples_v1 (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  feature_snapshot_id uuid not null references public.scorecaster_pit_feature_snapshots_v1(id) on delete restrict,
  outcome_id uuid not null references public.scorecaster_event_outcomes_v1(id) on delete restrict,
  feature_schema_version text not null,
  feature_input_hash text not null,
  outcome_hash text not null,
  target text not null,
  target_json jsonb not null default '{}'::jsonb,
  eligible_for_training boolean not null default false,
  exclusion_reasons jsonb not null default '[]'::jsonb,
  chronology_verified boolean not null default false,
  training_rights_verified boolean not null default false,
  example_hash text not null unique,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  unique (feature_snapshot_id, outcome_id)
);

create index if not exists scorecaster_learning_examples_event_idx
  on public.scorecaster_learning_examples_v1 (event_id, created_at desc);
create index if not exists scorecaster_learning_examples_eligible_idx
  on public.scorecaster_learning_examples_v1 (eligible_for_training, created_at desc);

create table if not exists public.scorecaster_model_predictions_v1 (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  feature_snapshot_id uuid references public.scorecaster_pit_feature_snapshots_v1(id) on delete restrict,
  as_of timestamptz not null,
  as_of_bucket timestamptz not null,
  model_id text not null,
  model_version text not null,
  model_family text not null,
  probabilities jsonb not null,
  expected_scores jsonb not null default '{}'::jsonb,
  calibration jsonb not null default '{}'::jsonb,
  independent_from_market boolean not null default false,
  feature_input_hash text,
  training_data_hash text,
  prediction_hash text not null unique,
  shadow_only boolean not null default true,
  production_probability_changed boolean not null default false check (production_probability_changed = false),
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create index if not exists scorecaster_model_predictions_event_time_idx
  on public.scorecaster_model_predictions_v1 (event_id, as_of desc);
create index if not exists scorecaster_model_predictions_model_time_idx
  on public.scorecaster_model_predictions_v1 (model_id, model_version, as_of desc);

create table if not exists public.scorecaster_model_registry_v1 (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  model_version text not null,
  sport_key text not null,
  model_family text not null,
  status text not null default 'shadow' check (status in ('research','shadow','challenger','review-candidate','champion','retired','blocked')),
  feature_schema_version text,
  training_data_hash text,
  code_commit_sha text,
  training_config jsonb not null default '{}'::jsonb,
  validation_metrics jsonb not null default '{}'::jsonb,
  holdout_metrics jsonb not null default '{}'::jsonb,
  promotion_gate jsonb not null default '{}'::jsonb,
  independent_from_market boolean not null default false,
  automatic_promotion_allowed boolean not null default false check (automatic_promotion_allowed = false),
  approved_by text,
  approved_at timestamptz,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, model_version)
);

create table if not exists public.scorecaster_source_health_snapshots_v1 (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null,
  source_id text not null,
  status text not null check (status in ('healthy','degraded','stale','offline','disabled','research-only')),
  last_observed_at timestamptz,
  age_minutes numeric,
  records_24h integer not null default 0,
  rights_ok boolean not null default false,
  training_rights_ok boolean not null default false,
  dependency_class text not null default 'optional' check (dependency_class in ('bootstrap','primary','secondary','optional','research')),
  diagnostics jsonb not null default '{}'::jsonb,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create index if not exists scorecaster_source_health_source_time_idx
  on public.scorecaster_source_health_snapshots_v1 (source_id, captured_at desc);

alter table public.scorecaster_canonical_facts_v1 enable row level security;
alter table public.scorecaster_canonical_facts_v1 force row level security;
alter table public.scorecaster_event_outcomes_v1 enable row level security;
alter table public.scorecaster_event_outcomes_v1 force row level security;
alter table public.scorecaster_team_state_snapshots_v1 enable row level security;
alter table public.scorecaster_team_state_snapshots_v1 force row level security;
alter table public.scorecaster_learning_examples_v1 enable row level security;
alter table public.scorecaster_learning_examples_v1 force row level security;
alter table public.scorecaster_model_predictions_v1 enable row level security;
alter table public.scorecaster_model_predictions_v1 force row level security;
alter table public.scorecaster_model_registry_v1 enable row level security;
alter table public.scorecaster_model_registry_v1 force row level security;
alter table public.scorecaster_source_health_snapshots_v1 enable row level security;
alter table public.scorecaster_source_health_snapshots_v1 force row level security;

revoke all on public.scorecaster_canonical_facts_v1 from anon, authenticated;
revoke all on public.scorecaster_event_outcomes_v1 from anon, authenticated;
revoke all on public.scorecaster_team_state_snapshots_v1 from anon, authenticated;
revoke all on public.scorecaster_learning_examples_v1 from anon, authenticated;
revoke all on public.scorecaster_model_predictions_v1 from anon, authenticated;
revoke all on public.scorecaster_model_registry_v1 from anon, authenticated;
revoke all on public.scorecaster_source_health_snapshots_v1 from anon, authenticated;

grant all on public.scorecaster_canonical_facts_v1 to service_role;
grant all on public.scorecaster_event_outcomes_v1 to service_role;
grant all on public.scorecaster_team_state_snapshots_v1 to service_role;
grant all on public.scorecaster_learning_examples_v1 to service_role;
grant all on public.scorecaster_model_predictions_v1 to service_role;
grant all on public.scorecaster_model_registry_v1 to service_role;
grant all on public.scorecaster_source_health_snapshots_v1 to service_role;
