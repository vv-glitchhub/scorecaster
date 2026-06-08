-- Scorecaster SQL Data Warehouse V1
-- Run this in Supabase SQL Editor.
-- Designed for paper trading analytics, model review, CLV tracking and market intelligence.

create table if not exists dw_bets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  external_id text,
  game_id text,
  sport_key text,
  league text,
  market_key text,
  selection text,
  home_team text,
  away_team text,
  bookmaker text,
  odds numeric,
  stake numeric default 0,
  model_probability numeric,
  market_probability numeric,
  edge numeric,
  ev numeric,
  agent_version text,
  final_score numeric,
  final_score_100 numeric,
  grade text,
  decision text,
  paper_mode boolean default true,
  raw_payload jsonb
);

create table if not exists dw_bet_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  bet_id uuid references dw_bets(id) on delete cascade,
  game_id text,
  result text,
  home_score numeric,
  away_score numeric,
  profit numeric default 0,
  roi numeric default 0,
  settled_at timestamptz default now(),
  raw_payload jsonb
);

create table if not exists dw_closing_lines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id text,
  sport_key text,
  league text,
  market_key text,
  selection text,
  bookmaker text,
  opening_odds numeric,
  current_odds numeric,
  closing_odds numeric,
  movement numeric,
  raw_payload jsonb
);

create table if not exists dw_market_movements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id text,
  sport_key text,
  league text,
  market_key text,
  selection text,
  bookmaker text,
  opening_odds numeric,
  latest_odds numeric,
  closing_odds numeric,
  movement_percent numeric,
  velocity numeric,
  signal text,
  pressure text,
  confidence numeric,
  raw_payload jsonb
);

create table if not exists dw_clv_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  bet_id uuid references dw_bets(id) on delete set null,
  game_id text,
  sport_key text,
  league text,
  market_key text,
  selection text,
  bookmaker text,
  reference_odds numeric,
  closing_odds numeric,
  clv numeric,
  clv_percent numeric,
  clv_grade text,
  clv_direction text,
  raw_payload jsonb
);

create table if not exists dw_model_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent_version text default 'V9',
  review_version text,
  total_records integer default 0,
  roi numeric default 0,
  hit_rate numeric default 0,
  average_clv numeric default 0,
  risk_mode text default 'balanced',
  weights jsonb,
  segment_profile jsonb,
  recommendations jsonb,
  raw_payload jsonb
);

create table if not exists dw_sharp_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id text,
  sport_key text,
  league text,
  market_key text,
  selection text,
  bookmaker text,
  odds numeric,
  decision text,
  final_score_100 numeric,
  sharp_index numeric,
  label text,
  components jsonb,
  signals jsonb,
  raw_payload jsonb
);

create table if not exists dw_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  alert_type text,
  severity text default 'info',
  game_id text,
  sport_key text,
  league text,
  market_key text,
  selection text,
  bookmaker text,
  title text,
  message text,
  score numeric,
  acknowledged boolean default false,
  raw_payload jsonb
);

create index if not exists dw_bets_game_id_idx on dw_bets(game_id);
create index if not exists dw_bets_sport_key_idx on dw_bets(sport_key);
create index if not exists dw_bets_league_idx on dw_bets(league);
create index if not exists dw_bets_market_key_idx on dw_bets(market_key);
create index if not exists dw_bets_decision_idx on dw_bets(decision);
create index if not exists dw_bet_results_bet_id_idx on dw_bet_results(bet_id);
create index if not exists dw_bet_results_game_id_idx on dw_bet_results(game_id);
create index if not exists dw_closing_lines_game_id_idx on dw_closing_lines(game_id);
create index if not exists dw_closing_lines_sport_key_idx on dw_closing_lines(sport_key);
create index if not exists dw_market_movements_signal_idx on dw_market_movements(signal);
create index if not exists dw_market_movements_pressure_idx on dw_market_movements(pressure);
create index if not exists dw_clv_history_grade_idx on dw_clv_history(clv_grade);
create index if not exists dw_sharp_history_label_idx on dw_sharp_history(label);
create index if not exists dw_alerts_type_idx on dw_alerts(alert_type);
create index if not exists dw_alerts_ack_idx on dw_alerts(acknowledged);
