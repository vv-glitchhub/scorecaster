-- Scorecaster Watchlist & Alerts V2
-- Run after scorecaster_auth_cloud.sql and scorecaster_api_rate_limits.sql.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id text not null,
  sport text not null,
  league text,
  market text not null default 'h2h',
  selection text not null,
  home_team text,
  away_team text,
  match text not null,
  commence_time timestamptz not null,
  added_odds numeric not null check (added_odds > 1 and added_odds <= 10000),
  added_decision text not null default 'WATCH',
  alert_move_percent numeric not null default 0.05,
  alert_before_minutes integer not null default 120,
  active boolean not null default true,
  raw_pick jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.watchlist_items add column if not exists alert_move_percent numeric not null default 0.05;
alter table public.watchlist_items add column if not exists alert_before_minutes integer not null default 120;
alter table public.watchlist_items add column if not exists active boolean not null default true;
alter table public.watchlist_items add column if not exists raw_pick jsonb not null default '{}'::jsonb;
alter table public.watchlist_items add column if not exists updated_at timestamptz not null default now();

alter table public.watchlist_items drop constraint if exists watchlist_decision_allowed;
alter table public.watchlist_items add constraint watchlist_decision_allowed
  check (added_decision in ('PLAY', 'WATCH', 'CAUTION', 'SKIP')) not valid;

alter table public.watchlist_items drop constraint if exists watchlist_move_range;
alter table public.watchlist_items add constraint watchlist_move_range
  check (alert_move_percent >= 0.005 and alert_move_percent <= 0.5) not valid;

alter table public.watchlist_items drop constraint if exists watchlist_before_range;
alter table public.watchlist_items add constraint watchlist_before_range
  check (alert_before_minutes >= 15 and alert_before_minutes <= 10080) not valid;

create unique index if not exists idx_watchlist_user_event_selection
  on public.watchlist_items(user_id, event_id, market, selection);
create index if not exists idx_watchlist_user_active
  on public.watchlist_items(user_id, active, commence_time);

create or replace function public.set_watchlist_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists watchlist_set_updated_at on public.watchlist_items;
create trigger watchlist_set_updated_at
before update on public.watchlist_items
for each row execute function public.set_watchlist_updated_at();

alter table public.watchlist_items enable row level security;
alter table public.watchlist_items force row level security;

drop policy if exists "Users manage own watchlist" on public.watchlist_items;
create policy "Users manage own watchlist"
on public.watchlist_items for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on public.watchlist_items from anon;
grant select, insert, update, delete on public.watchlist_items to authenticated;
