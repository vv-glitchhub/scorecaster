-- Scorecaster Own Decision Engine V1
-- Auditable decisions produced only from Scorecaster-owned derived intelligence.

create table if not exists public.scorecaster_own_decisions_v1 (
  id uuid primary key default gen_random_uuid(),
  decision_hash text not null unique,
  event_id text not null,
  sport_key text not null default 'soccer',
  league text,
  home_team text,
  away_team text,
  commence_time timestamptz,
  as_of timestamptz not null,
  as_of_bucket timestamptz not null,
  intelligence_decision text not null check (intelligence_decision in ('OWN_PREDICTION_READY','OWN_PREDICTION_CAUTION','OWN_PREDICTION_SKIP')),
  selected_outcome text check (selected_outcome is null or selected_outcome in ('home','draw','away')),
  fair_probability numeric,
  fair_odds numeric,
  confidence_score numeric,
  champion_model_id text not null,
  champion_model_version text not null,
  champion_probabilities jsonb not null,
  challenger_model_id text,
  challenger_model_version text,
  challenger_probabilities jsonb,
  challenger_status text,
  disagreement_gap numeric,
  market_mapped boolean not null default false,
  market_source_id text,
  market_source_event_id text,
  market_probability numeric,
  market_odds numeric,
  paper_edge numeric,
  paper_ev numeric,
  reason_codes jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  production_play_upgrade_allowed boolean not null default false,
  production_probability_changed boolean not null default false,
  automatic_model_promotion_allowed boolean not null default false,
  real_money_action_available boolean not null default false,
  paper_only boolean not null default true,
  created_at timestamptz not null default now(),
  unique(event_id, as_of_bucket, champion_model_id, champion_model_version)
);

create index if not exists scorecaster_own_decisions_event_idx on public.scorecaster_own_decisions_v1(event_id, as_of desc);
create index if not exists scorecaster_own_decisions_decision_idx on public.scorecaster_own_decisions_v1(intelligence_decision, as_of desc);
create index if not exists scorecaster_own_decisions_commence_idx on public.scorecaster_own_decisions_v1(commence_time);

alter table public.scorecaster_own_decisions_v1 enable row level security;
alter table public.scorecaster_own_decisions_v1 force row level security;
revoke all on public.scorecaster_own_decisions_v1 from anon, authenticated;
grant all on public.scorecaster_own_decisions_v1 to service_role;
