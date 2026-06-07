-- Scorecaster Learning Database Schema
-- Run this in Supabase SQL Editor.

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id text,
  sport_key text,
  sport_title text,
  league text,
  market_key text,
  selection text,
  home_team text,
  away_team text,
  bookmaker text,
  odds numeric,
  model_probability numeric,
  market_probability numeric,
  edge numeric,
  ev numeric,
  final_score numeric,
  final_score_100 numeric,
  grade_v9 text,
  decision text,
  quality_score numeric,
  quality_grade text,
  source_trust numeric,
  sentiment_score numeric,
  sharp_money_score numeric,
  sharp_money_label text,
  match_context_score numeric,
  match_context_grade text,
  stake numeric,
  raw_payload jsonb
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  prediction_id uuid references predictions(id) on delete cascade,
  game_id text,
  result text,
  home_score numeric,
  away_score numeric,
  profit numeric default 0,
  roi numeric default 0,
  settled_at timestamptz default now(),
  raw_payload jsonb
);

create table if not exists clv_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  prediction_id uuid references predictions(id) on delete cascade,
  bet_odds numeric,
  current_odds numeric,
  closing_odds numeric,
  clv numeric,
  clv_percent numeric,
  clv_grade text,
  positive boolean default false,
  learning_signal jsonb,
  raw_payload jsonb
);

create table if not exists agent_learning_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent_version text default 'V9',
  learning_version text default 'V4',
  total_records integer default 0,
  roi numeric default 0,
  hit_rate numeric default 0,
  average_clv numeric default 0,
  risk_mode text default 'balanced',
  summary jsonb,
  weights jsonb,
  league_weights jsonb,
  market_weights jsonb,
  bookmaker_weights jsonb,
  recommendations jsonb
);

create table if not exists model_weights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  active boolean default true,
  agent_version text default 'V9',
  edge_weight numeric default 1,
  quality_weight numeric default 1,
  trust_weight numeric default 1,
  clv_weight numeric default 1,
  sharp_weight numeric default 1,
  context_weight numeric default 1,
  risk_mode text default 'balanced',
  source_snapshot_id uuid references agent_learning_snapshots(id) on delete set null
);

create index if not exists predictions_game_id_idx on predictions(game_id);
create index if not exists predictions_sport_key_idx on predictions(sport_key);
create index if not exists predictions_league_idx on predictions(league);
create index if not exists predictions_decision_idx on predictions(decision);
create index if not exists results_prediction_id_idx on results(prediction_id);
create index if not exists clv_prediction_id_idx on clv_history(prediction_id);
create index if not exists model_weights_active_idx on model_weights(active);
