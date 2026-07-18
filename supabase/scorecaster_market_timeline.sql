-- Scorecaster Market Timeline V1
-- Run after scorecaster_watchlist_alerts.sql and scorecaster_api_rate_limits.sql.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.market_timeline_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  watchlist_id uuid not null references public.watchlist_items(id) on delete cascade,
  event_id text not null,
  sport text not null,
  league text,
  market text not null default 'h2h',
  selection text not null,
  odds numeric not null,
  decision text not null default 'WATCH',
  consensus_probability numeric,
  edge numeric,
  ev numeric,
  confidence numeric,
  bookmaker text,
  source text not null default 'server-top-picks',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.market_timeline_snapshots drop constraint if exists market_timeline_odds_range;
alter table public.market_timeline_snapshots add constraint market_timeline_odds_range
  check (odds > 1 and odds <= 10000) not valid;

alter table public.market_timeline_snapshots drop constraint if exists market_timeline_decision_allowed;
alter table public.market_timeline_snapshots add constraint market_timeline_decision_allowed
  check (decision in ('PLAY', 'WATCH', 'CAUTION', 'SKIP')) not valid;

alter table public.market_timeline_snapshots drop constraint if exists market_timeline_probability_range;
alter table public.market_timeline_snapshots add constraint market_timeline_probability_range
  check (consensus_probability is null or (consensus_probability > 0 and consensus_probability < 1)) not valid;

alter table public.market_timeline_snapshots drop constraint if exists market_timeline_confidence_range;
alter table public.market_timeline_snapshots add constraint market_timeline_confidence_range
  check (confidence is null or (confidence >= 0 and confidence <= 1)) not valid;

create index if not exists idx_market_timeline_user_event_selection
  on public.market_timeline_snapshots(user_id, event_id, market, selection, captured_at asc);
create index if not exists idx_market_timeline_watchlist_time
  on public.market_timeline_snapshots(watchlist_id, captured_at desc);

alter table public.market_timeline_snapshots enable row level security;
alter table public.market_timeline_snapshots force row level security;

drop policy if exists "Users manage own market timeline" on public.market_timeline_snapshots;
create policy "Users manage own market timeline"
on public.market_timeline_snapshots for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on public.market_timeline_snapshots from anon;
grant select, insert, delete on public.market_timeline_snapshots to authenticated;
