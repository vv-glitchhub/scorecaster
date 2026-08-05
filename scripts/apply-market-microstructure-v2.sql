-- Scorecaster Market Microstructure V2 production patch
-- Safe to run more than once in Supabase SQL Editor.
-- Creates server-only normalized provider-price history. No raw provider payload is stored.

begin;

create extension if not exists pgcrypto;

create table if not exists public.market_capture_runs_v2 (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null check (status in ('running', 'success', 'partial', 'failed', 'disabled')),
  source_id text not null default 'the_odds_api',
  league_count integer not null default 0 check (league_count >= 0),
  event_count integer not null default 0 check (event_count >= 0),
  record_count integer not null default 0 check (record_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  diagnostics jsonb not null default '[]'::jsonb,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now()
);

create table if not exists public.market_provider_snapshots_v2 (
  id uuid primary key,
  capture_id uuid not null references public.market_capture_runs_v2(id) on delete cascade,
  event_id text not null,
  sport text not null,
  league text,
  commence_time timestamptz not null,
  market text not null check (market in ('h2h', 'spreads', 'totals')),
  selection text not null,
  point numeric,
  bookmaker_key text not null,
  bookmaker_title text not null,
  price numeric not null check (price > 1 and price <= 10000),
  implied_probability numeric not null check (implied_probability > 0 and implied_probability < 1),
  normalized_probability numeric not null check (normalized_probability > 0 and normalized_probability < 1),
  market_overround numeric,
  provider_last_update timestamptz not null,
  captured_at timestamptz not null,
  source_id text not null default 'the_odds_api',
  source_reference text not null,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  constraint market_provider_snapshots_v2_prestart check (captured_at < commence_time),
  constraint market_provider_snapshots_v2_provider_time check (provider_last_update <= captured_at + interval '5 minutes'),
  constraint market_provider_snapshots_v2_source_reference_unique unique (source_id, source_reference)
);

create index if not exists market_provider_snapshots_v2_event_market_time_idx
  on public.market_provider_snapshots_v2(event_id, market, captured_at asc);
create index if not exists market_provider_snapshots_v2_event_selection_time_idx
  on public.market_provider_snapshots_v2(event_id, market, selection, captured_at asc);
create index if not exists market_provider_snapshots_v2_provider_time_idx
  on public.market_provider_snapshots_v2(bookmaker_key, provider_last_update desc);
create index if not exists market_provider_snapshots_v2_commence_idx
  on public.market_provider_snapshots_v2(commence_time asc);
create index if not exists market_capture_runs_v2_started_idx
  on public.market_capture_runs_v2(started_at desc);

alter table public.market_capture_runs_v2 enable row level security;
alter table public.market_capture_runs_v2 force row level security;
alter table public.market_provider_snapshots_v2 enable row level security;
alter table public.market_provider_snapshots_v2 force row level security;

revoke all privileges on table public.market_capture_runs_v2 from public, anon, authenticated;
revoke all privileges on table public.market_provider_snapshots_v2 from public, anon, authenticated;
grant all privileges on table public.market_capture_runs_v2 to service_role;
grant all privileges on table public.market_provider_snapshots_v2 to service_role;

comment on table public.market_capture_runs_v2 is
  'Server-only audit of normalized market microstructure capture runs. Paper-only.';
comment on table public.market_provider_snapshots_v2 is
  'Immutable normalized provider prices used for opening/current/closing evidence. Raw upstream payloads are not stored.';
comment on column public.market_provider_snapshots_v2.normalized_probability is
  'Provider-level no-vig probability normalized within the bookmaker market at capture time.';
comment on column public.market_provider_snapshots_v2.source_reference is
  'Deterministic hash of source, event, market, selection, bookmaker, provider update, price and point.';

commit;

notify pgrst, 'reload schema';
