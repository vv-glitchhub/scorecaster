-- Scorecaster Alert Inbox V1
-- Run after scorecaster_watchlist_alerts.sql and scorecaster_api_rate_limits.sql.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.alert_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  watchlist_id uuid not null references public.watchlist_items(id) on delete cascade,
  fingerprint text not null,
  alert_type text not null,
  severity text not null default 'info',
  title text not null,
  message text not null,
  match text,
  selection text,
  details jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  read_at timestamptz,
  resolved_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.alert_inbox add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.alert_inbox add column if not exists active boolean not null default true;
alter table public.alert_inbox add column if not exists read_at timestamptz;
alter table public.alert_inbox add column if not exists resolved_at timestamptz;
alter table public.alert_inbox add column if not exists first_seen_at timestamptz not null default now();
alter table public.alert_inbox add column if not exists last_seen_at timestamptz not null default now();
alter table public.alert_inbox add column if not exists updated_at timestamptz not null default now();

alter table public.alert_inbox drop constraint if exists alert_inbox_severity_allowed;
alter table public.alert_inbox add constraint alert_inbox_severity_allowed
  check (severity in ('high', 'medium', 'info')) not valid;

alter table public.alert_inbox drop constraint if exists alert_inbox_fingerprint_length;
alter table public.alert_inbox add constraint alert_inbox_fingerprint_length
  check (char_length(fingerprint) between 1 and 240) not valid;

alter table public.alert_inbox drop constraint if exists alert_inbox_text_lengths;
alter table public.alert_inbox add constraint alert_inbox_text_lengths
  check (
    char_length(alert_type) between 1 and 80 and
    char_length(title) between 1 and 240 and
    char_length(message) between 1 and 800
  ) not valid;

create unique index if not exists idx_alert_inbox_user_fingerprint
  on public.alert_inbox(user_id, fingerprint);
create index if not exists idx_alert_inbox_user_unread
  on public.alert_inbox(user_id, read_at, last_seen_at desc);
create index if not exists idx_alert_inbox_user_active
  on public.alert_inbox(user_id, active, severity, last_seen_at desc);
create index if not exists idx_alert_inbox_watchlist
  on public.alert_inbox(watchlist_id, active);

create or replace function public.set_alert_inbox_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists alert_inbox_set_updated_at on public.alert_inbox;
create trigger alert_inbox_set_updated_at
before update on public.alert_inbox
for each row execute function public.set_alert_inbox_updated_at();

alter table public.alert_inbox enable row level security;
alter table public.alert_inbox force row level security;

drop policy if exists "Users manage own alert inbox" on public.alert_inbox;
create policy "Users manage own alert inbox"
on public.alert_inbox for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on public.alert_inbox from anon;
grant select, insert, update, delete on public.alert_inbox to authenticated;
