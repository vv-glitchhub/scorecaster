-- Scorecaster Production MVP schema draft
-- Safe to review before running in Supabase SQL editor.

create table if not exists public.bankroll_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  bankroll numeric not null default 1000,
  max_stake_percent numeric not null default 2,
  max_daily_exposure_percent numeric not null default 8,
  max_single_league_exposure_percent numeric not null default 4,
  min_edge numeric not null default 0.025,
  min_confidence numeric not null default 0.58,
  paper_trading_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bet_slips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  status text not null default 'draft',
  total_stake numeric not null default 0,
  potential_return numeric not null default 0,
  potential_profit numeric not null default 0,
  decision text not null default 'OK',
  warnings jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bet_slip_items (
  id uuid primary key default gen_random_uuid(),
  bet_slip_id uuid references public.bet_slips(id) on delete cascade,
  user_id uuid,
  sport text,
  league text,
  match text not null,
  market text not null default 'h2h',
  selection text not null,
  bookmaker text,
  odds numeric not null,
  stake numeric not null default 0,
  edge numeric,
  ev numeric,
  confidence numeric,
  model_probability numeric,
  implied_probability numeric,
  decision text not null default 'OK',
  risk_warnings jsonb not null default '[]'::jsonb,
  risk_blockers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tracked_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  source_bet_slip_item_id uuid,
  sport text,
  league text,
  match text not null,
  market text not null default 'h2h',
  selection text not null,
  bookmaker text,
  odds numeric not null,
  stake numeric not null,
  edge numeric,
  ev numeric,
  confidence numeric,
  model_probability numeric,
  implied_probability numeric,
  status text not null default 'open',
  result text,
  profit numeric,
  closing_odds numeric,
  clv numeric,
  tracked_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists public.odds_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tracked_bet_id uuid references public.tracked_bets(id) on delete cascade,
  sport text,
  league text,
  match text,
  market text,
  selection text,
  bookmaker text,
  odds numeric not null,
  source text,
  captured_at timestamptz not null default now()
);

create table if not exists public.pick_explanations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tracked_bet_id uuid,
  match text,
  selection text,
  agent_version text not null default 'agent-v9',
  explanation text not null,
  risk_summary text,
  no_bet_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tracked_bet_id uuid,
  agent_version text not null default 'agent-v9',
  feedback text,
  rating integer,
  created_at timestamptz not null default now()
);

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_type text not null,
  severity text not null default 'info',
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tracked_bets_user_status on public.tracked_bets(user_id, status);
create index if not exists idx_tracked_bets_league on public.tracked_bets(league);
create index if not exists idx_odds_snapshots_tracked_bet on public.odds_snapshots(tracked_bet_id);
create index if not exists idx_risk_events_user_created on public.risk_events(user_id, created_at desc);
