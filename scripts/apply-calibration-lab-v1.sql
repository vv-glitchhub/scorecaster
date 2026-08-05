-- Scorecaster CLV and Calibration Lab V1 production patch
-- Safe to run more than once in Supabase SQL Editor.
-- Stores server-computed paper-only observations from real pre-start closing evidence.

begin;

create extension if not exists pgcrypto;

create table if not exists public.calibration_observations_v1 (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bet_id uuid not null references public.bets(id) on delete cascade,
  event_id text not null,
  sport text not null,
  league text,
  market text not null,
  selection text not null,
  bookmaker text,
  decision text,
  model_version text not null default 'unknown',
  entry_odds numeric not null check (entry_odds > 1 and entry_odds <= 10000),
  entry_market_probability numeric check (entry_market_probability is null or (entry_market_probability > 0 and entry_market_probability < 1)),
  model_probability numeric check (model_probability is null or (model_probability > 0 and model_probability < 1)),
  closing_consensus_probability numeric check (closing_consensus_probability is null or (closing_consensus_probability > 0 and closing_consensus_probability < 1)),
  closing_fair_odds numeric check (closing_fair_odds is null or closing_fair_odds > 1),
  closing_provider_count integer not null default 0 check (closing_provider_count >= 0),
  closing_captured_at timestamptz,
  commence_time timestamptz not null,
  bet_created_at timestamptz not null,
  settled_at timestamptz,
  status text not null,
  outcome_value integer check (outcome_value is null or outcome_value in (0, 1)),
  stake numeric not null default 0 check (stake >= 0),
  profit numeric,
  price_clv numeric,
  probability_clv numeric,
  brier_score numeric check (brier_score is null or (brier_score >= 0 and brier_score <= 1)),
  log_loss numeric check (log_loss is null or log_loss >= 0),
  exclusion_reason text,
  evidence_version text not null default 'scorecaster-calibration-lab-v1',
  source_id text not null default 'market-microstructure-v2',
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calibration_observations_v1_bet_unique unique (bet_id),
  constraint calibration_observations_v1_closing_prestart check (
    closing_captured_at is null or closing_captured_at < commence_time
  ),
  constraint calibration_observations_v1_entry_prestart check (bet_created_at < commence_time),
  constraint calibration_observations_v1_exclusion_consistency check (
    exclusion_reason is not null
    or (
      outcome_value is not null
      and model_probability is not null
      and closing_consensus_probability is not null
      and closing_fair_odds is not null
      and closing_provider_count >= 2
      and closing_captured_at is not null
      and price_clv is not null
      and brier_score is not null
      and log_loss is not null
    )
  )
);

create table if not exists public.calibration_settlement_runs_v1 (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null check (status in ('running', 'success', 'partial', 'failed', 'disabled')),
  settled_bets_seen integer not null default 0 check (settled_bets_seen >= 0),
  observations_written integer not null default 0 check (observations_written >= 0),
  exclusions_written integer not null default 0 check (exclusions_written >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  diagnostics jsonb not null default '[]'::jsonb,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create index if not exists calibration_observations_v1_user_time_idx
  on public.calibration_observations_v1(user_id, bet_created_at desc);
create index if not exists calibration_observations_v1_event_selection_idx
  on public.calibration_observations_v1(event_id, market, selection);
create index if not exists calibration_observations_v1_model_idx
  on public.calibration_observations_v1(model_version, bet_created_at desc);
create index if not exists calibration_observations_v1_slice_idx
  on public.calibration_observations_v1(sport, league, market, bookmaker, decision);
create index if not exists calibration_observations_v1_exclusion_idx
  on public.calibration_observations_v1(exclusion_reason)
  where exclusion_reason is not null;
create index if not exists calibration_settlement_runs_v1_started_idx
  on public.calibration_settlement_runs_v1(started_at desc);

alter table public.calibration_observations_v1 enable row level security;
alter table public.calibration_observations_v1 force row level security;
alter table public.calibration_settlement_runs_v1 enable row level security;
alter table public.calibration_settlement_runs_v1 force row level security;

revoke all privileges on table public.calibration_observations_v1 from public, anon, authenticated;
revoke all privileges on table public.calibration_settlement_runs_v1 from public, anon, authenticated;
grant all privileges on table public.calibration_observations_v1 to service_role;
grant all privileges on table public.calibration_settlement_runs_v1 to service_role;

comment on table public.calibration_observations_v1 is
  'Immutable per-paper-bet CLV and calibration evidence built from final eligible pre-start market snapshots. Server-only.';
comment on column public.calibration_observations_v1.exclusion_reason is
  'Explicit reason a settled paper bet cannot contribute to trusted calibration metrics.';
comment on column public.calibration_observations_v1.price_clv is
  'entry_odds * closing_no_vig_probability - 1. Positive means the entry price beat the fair closing line.';
comment on column public.calibration_observations_v1.probability_clv is
  'closing_no_vig_probability - entry_market_probability.';

commit;

notify pgrst, 'reload schema';
