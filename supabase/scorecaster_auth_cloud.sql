-- Scorecaster Auth + Cloud Sync migration
-- Run this after supabase/scorecaster_schema.sql in the Supabase SQL editor.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_ref text,
  label text not null default '',
  market text not null default 'h2h',
  bookmaker text,
  sport text,
  league text,
  home_team text,
  away_team text,
  match text,
  odds numeric not null check (odds > 1),
  stake numeric not null default 0 check (stake >= 0),
  edge numeric,
  ev numeric,
  confidence numeric,
  status text not null default 'open',
  result text,
  profit numeric,
  closing_odds numeric,
  clv numeric,
  raw_pick jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bets add column if not exists client_ref text;
alter table public.bets add column if not exists match text;
alter table public.bets add column if not exists confidence numeric;
alter table public.bets add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_bets_user_client_ref
  on public.bets(user_id, client_ref);
create index if not exists idx_bets_user_created
  on public.bets(user_id, created_at desc);
create index if not exists idx_bets_user_status
  on public.bets(user_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bets_set_updated_at on public.bets;
create trigger bets_set_updated_at
before update on public.bets
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.bets enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users manage own bets" on public.bets;
create policy "Users manage own bets"
on public.bets for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Apply user isolation to the original Production MVP tables when they exist.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'bankroll_settings',
    'bet_slips',
    'bet_slip_items',
    'tracked_bets',
    'odds_snapshots',
    'pick_explanations',
    'agent_feedback',
    'risk_events'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('alter table public.%I alter column user_id set default auth.uid()', table_name);
      execute format('drop policy if exists "Users manage own rows" on public.%I', table_name);
      execute format(
        'create policy "Users manage own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        table_name
      );
    end if;
  end loop;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.bets to authenticated;
