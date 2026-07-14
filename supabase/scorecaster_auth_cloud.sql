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

-- Keep exactly one paper-bankroll settings row per authenticated user so the
-- API can use ON CONFLICT (user_id) safely. Null prototype rows are untouched.
with ranked as (
  select id,
         row_number() over (
           partition by user_id
           order by updated_at desc nulls last, created_at desc nulls last, id desc
         ) as row_number
  from public.bankroll_settings
  where user_id is not null
)
delete from public.bankroll_settings
where id in (select id from ranked where row_number > 1);

create unique index if not exists idx_bankroll_settings_user_unique
  on public.bankroll_settings(user_id);

-- Future writes must stay inside conservative paper-tracking bounds. NOT VALID
-- keeps this migration deployable even if old prototype rows need cleanup.
alter table public.bets drop constraint if exists bets_status_allowed;
alter table public.bets add constraint bets_status_allowed
  check (status in ('open', 'won', 'lost', 'void', 'push')) not valid;

alter table public.bets drop constraint if exists bets_stake_paper_limit;
alter table public.bets add constraint bets_stake_paper_limit
  check (stake >= 0 and stake <= 10000000) not valid;

alter table public.bets drop constraint if exists bets_confidence_range;
alter table public.bets add constraint bets_confidence_range
  check (confidence is null or (confidence >= 0 and confidence <= 1)) not valid;

alter table public.bets drop constraint if exists bets_edge_range;
alter table public.bets add constraint bets_edge_range
  check (edge is null or (edge >= -1 and edge <= 1)) not valid;

alter table public.bankroll_settings drop constraint if exists bankroll_paper_mode_only;
alter table public.bankroll_settings add constraint bankroll_paper_mode_only
  check (paper_trading_mode = true) not valid;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
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

drop trigger if exists bankroll_settings_set_updated_at on public.bankroll_settings;
create trigger bankroll_settings_set_updated_at
before update on public.bankroll_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
alter table public.profiles force row level security;
alter table public.bets enable row level security;
alter table public.bets force row level security;
alter table public.bankroll_settings enable row level security;
alter table public.bankroll_settings force row level security;

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

drop policy if exists "Users manage own rows" on public.bankroll_settings;
drop policy if exists "Users manage own bankroll settings" on public.bankroll_settings;
create policy "Users manage own bankroll settings"
on public.bankroll_settings for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and paper_trading_mode = true);

-- Apply user isolation to the other original Production MVP tables when they exist.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
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
      execute format('alter table public.%I force row level security', table_name);
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

-- Anonymous clients must not read or write account data. The publishable key is
-- safe in clients only because authenticated JWTs and RLS decide row access.
revoke all on public.profiles from anon;
revoke all on public.bets from anon;
revoke all on public.bankroll_settings from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.bets to authenticated;
grant select, insert, update, delete on public.bankroll_settings to authenticated;
