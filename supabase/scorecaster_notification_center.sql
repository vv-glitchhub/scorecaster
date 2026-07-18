-- Scorecaster Notification Center V1
-- Run after scorecaster_watchlist_alerts.sql and scorecaster_api_rate_limits.sql.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.notification_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  minimum_severity text not null default 'info',
  kickoff_enabled boolean not null default true,
  price_enabled boolean not null default true,
  decision_enabled boolean not null default true,
  availability_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings add column if not exists in_app_enabled boolean not null default true;
alter table public.notification_settings add column if not exists minimum_severity text not null default 'info';
alter table public.notification_settings add column if not exists kickoff_enabled boolean not null default true;
alter table public.notification_settings add column if not exists price_enabled boolean not null default true;
alter table public.notification_settings add column if not exists decision_enabled boolean not null default true;
alter table public.notification_settings add column if not exists availability_enabled boolean not null default true;
alter table public.notification_settings add column if not exists created_at timestamptz not null default now();
alter table public.notification_settings add column if not exists updated_at timestamptz not null default now();

alter table public.notification_settings drop constraint if exists notification_minimum_severity_allowed;
alter table public.notification_settings add constraint notification_minimum_severity_allowed
  check (minimum_severity in ('info', 'medium', 'high')) not valid;

create table if not exists public.notification_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_key text not null,
  source_type text not null default 'watchlist',
  notification_type text not null,
  severity text not null,
  watchlist_id uuid,
  event_id text not null,
  match text,
  selection text not null,
  commence_time timestamptz,
  payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_items add column if not exists source_key text;
alter table public.notification_items add column if not exists source_type text not null default 'watchlist';
alter table public.notification_items add column if not exists notification_type text;
alter table public.notification_items add column if not exists severity text;
alter table public.notification_items add column if not exists watchlist_id uuid;
alter table public.notification_items add column if not exists event_id text;
alter table public.notification_items add column if not exists match text;
alter table public.notification_items add column if not exists selection text;
alter table public.notification_items add column if not exists commence_time timestamptz;
alter table public.notification_items add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.notification_items add column if not exists first_seen_at timestamptz not null default now();
alter table public.notification_items add column if not exists last_seen_at timestamptz not null default now();
alter table public.notification_items add column if not exists read_at timestamptz;
alter table public.notification_items add column if not exists dismissed_at timestamptz;
alter table public.notification_items add column if not exists created_at timestamptz not null default now();
alter table public.notification_items add column if not exists updated_at timestamptz not null default now();

alter table public.notification_items drop constraint if exists notification_source_type_allowed;
alter table public.notification_items add constraint notification_source_type_allowed
  check (source_type in ('watchlist')) not valid;

alter table public.notification_items drop constraint if exists notification_type_allowed;
alter table public.notification_items add constraint notification_type_allowed
  check (notification_type in ('kickoff_soon', 'decision_changed', 'price_moved', 'below_play_price', 'market_unavailable', 'fixture_passed')) not valid;

alter table public.notification_items drop constraint if exists notification_severity_allowed;
alter table public.notification_items add constraint notification_severity_allowed
  check (severity in ('info', 'medium', 'high')) not valid;

create unique index if not exists idx_notification_user_source
  on public.notification_items(user_id, source_key);
create index if not exists idx_notification_user_inbox
  on public.notification_items(user_id, dismissed_at, read_at, last_seen_at desc);
create index if not exists idx_notification_user_severity
  on public.notification_items(user_id, severity, last_seen_at desc);

create or replace function public.set_notification_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_settings_set_updated_at on public.notification_settings;
create trigger notification_settings_set_updated_at
before update on public.notification_settings
for each row execute function public.set_notification_updated_at();

drop trigger if exists notification_items_set_updated_at on public.notification_items;
create trigger notification_items_set_updated_at
before update on public.notification_items
for each row execute function public.set_notification_updated_at();

alter table public.notification_settings enable row level security;
alter table public.notification_settings force row level security;
alter table public.notification_items enable row level security;
alter table public.notification_items force row level security;

drop policy if exists "Users manage own notification settings" on public.notification_settings;
create policy "Users manage own notification settings"
on public.notification_settings for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own notifications" on public.notification_items;
create policy "Users manage own notifications"
on public.notification_items for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on public.notification_settings from anon;
revoke all on public.notification_items from anon;
grant select, insert, update, delete on public.notification_settings to authenticated;
grant select, insert, update, delete on public.notification_items to authenticated;
