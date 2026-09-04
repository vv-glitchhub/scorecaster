-- Scorecaster External Slip Tracking V1
-- Prerequisite: supabase/scorecaster_auth_cloud.sql (public.set_updated_at())
--
-- External slips are informational references to bets created outside Scorecaster.
-- They are intentionally isolated from public.bets, virtual bankroll enforcement,
-- autonomous-agent stake logic, shadow learning and paper-performance metrics.

create extension if not exists pgcrypto;

create table if not exists public.external_slips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null default 'manual',
  external_reference text,
  title text not null default 'External slip',
  currency text not null default 'EUR',
  stake numeric,
  combined_odds numeric not null,
  potential_return numeric,
  purchased_at timestamptz,
  resolves_at timestamptz,
  status text not null default 'open',
  legs jsonb not null default '[]'::jsonb,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_slips_currency_length check (char_length(currency) = 3),
  constraint external_slips_stake_nonnegative check (stake is null or (stake >= 0 and stake <= 10000000)),
  constraint external_slips_combined_odds_range check (combined_odds > 1 and combined_odds <= 100000000),
  constraint external_slips_potential_return_nonnegative check (potential_return is null or (potential_return >= 0 and potential_return <= 1000000000)),
  constraint external_slips_status_allowed check (status in ('open', 'won', 'lost', 'void')),
  constraint external_slips_legs_array check (jsonb_typeof(legs) = 'array'),
  constraint external_slips_legs_limit check (jsonb_array_length(legs) between 1 and 50)
);

create index if not exists idx_external_slips_user_created
  on public.external_slips(user_id, created_at desc);
create index if not exists idx_external_slips_user_status
  on public.external_slips(user_id, status, created_at desc);
create unique index if not exists idx_external_slips_user_provider_reference
  on public.external_slips(user_id, provider, external_reference)
  where external_reference is not null and btrim(external_reference) <> '';

alter table public.external_slips enable row level security;
alter table public.external_slips force row level security;

revoke all on table public.external_slips from anon;
grant select, insert, update, delete on table public.external_slips to authenticated;
grant select, insert, update, delete on table public.external_slips to service_role;

-- Every client-visible operation is owner-scoped. The API also repeats the
-- user_id filter to give Postgres a selective predicate in addition to RLS.
drop policy if exists "Users read own external slips" on public.external_slips;
create policy "Users read own external slips"
on public.external_slips for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users create own external slips" on public.external_slips;
create policy "Users create own external slips"
on public.external_slips for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own external slips" on public.external_slips;
create policy "Users update own external slips"
on public.external_slips for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own external slips" on public.external_slips;
create policy "Users delete own external slips"
on public.external_slips for delete
to authenticated
using ((select auth.uid()) = user_id);

drop trigger if exists external_slips_set_updated_at on public.external_slips;
create trigger external_slips_set_updated_at
before update on public.external_slips
for each row execute function public.set_updated_at();
