-- Scorecaster Alert Inbox V2
-- Run after scorecaster_alert_inbox.sql.
-- Safe to run more than once.

alter table public.alert_inbox
  add column if not exists dismissed_at timestamptz;

create index if not exists idx_alert_inbox_user_visible
  on public.alert_inbox(user_id, dismissed_at, read_at, last_seen_at desc);

create table if not exists public.alert_inbox_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  minimum_severity text not null default 'info',
  kickoff_enabled boolean not null default true,
  price_enabled boolean not null default true,
  decision_enabled boolean not null default true,
  availability_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.alert_inbox_settings add column if not exists enabled boolean not null default true;
alter table public.alert_inbox_settings add column if not exists minimum_severity text not null default 'info';
alter table public.alert_inbox_settings add column if not exists kickoff_enabled boolean not null default true;
alter table public.alert_inbox_settings add column if not exists price_enabled boolean not null default true;
alter table public.alert_inbox_settings add column if not exists decision_enabled boolean not null default true;
alter table public.alert_inbox_settings add column if not exists availability_enabled boolean not null default true;
alter table public.alert_inbox_settings add column if not exists created_at timestamptz not null default now();
alter table public.alert_inbox_settings add column if not exists updated_at timestamptz not null default now();

alter table public.alert_inbox_settings drop constraint if exists alert_inbox_settings_severity_allowed;
alter table public.alert_inbox_settings add constraint alert_inbox_settings_severity_allowed
  check (minimum_severity in ('info', 'medium', 'high')) not valid;

create or replace function public.set_alert_inbox_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists alert_inbox_settings_set_updated_at on public.alert_inbox_settings;
create trigger alert_inbox_settings_set_updated_at
before update on public.alert_inbox_settings
for each row execute function public.set_alert_inbox_settings_updated_at();

alter table public.alert_inbox_settings enable row level security;
alter table public.alert_inbox_settings force row level security;

drop policy if exists "Users manage own alert inbox settings" on public.alert_inbox_settings;
create policy "Users manage own alert inbox settings"
on public.alert_inbox_settings for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on public.alert_inbox_settings from anon;
grant select, insert, update, delete on public.alert_inbox_settings to authenticated;
