-- Scorecaster Notification Preferences & Device Registry V1
-- Run after scorecaster_alert_inbox.sql and scorecaster_api_rate_limits.sql.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default false,
  high_enabled boolean not null default true,
  medium_enabled boolean not null default true,
  info_enabled boolean not null default false,
  kickoff_enabled boolean not null default true,
  decision_enabled boolean not null default true,
  price_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences add column if not exists in_app_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists push_enabled boolean not null default false;
alter table public.notification_preferences add column if not exists high_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists medium_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists info_enabled boolean not null default false;
alter table public.notification_preferences add column if not exists kickoff_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists decision_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists price_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists updated_at timestamptz not null default now();

create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expo_push_token text not null,
  token_hash text not null,
  platform text not null,
  app_version text,
  build_version text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_devices add column if not exists app_version text;
alter table public.notification_devices add column if not exists build_version text;
alter table public.notification_devices add column if not exists enabled boolean not null default true;
alter table public.notification_devices add column if not exists last_seen_at timestamptz not null default now();
alter table public.notification_devices add column if not exists updated_at timestamptz not null default now();

alter table public.notification_devices drop constraint if exists notification_device_platform_allowed;
alter table public.notification_devices add constraint notification_device_platform_allowed
  check (platform in ('ios', 'android')) not valid;

alter table public.notification_devices drop constraint if exists notification_device_token_format;
alter table public.notification_devices add constraint notification_device_token_format
  check (expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{20,200}\]$') not valid;

alter table public.notification_devices drop constraint if exists notification_device_hash_format;
alter table public.notification_devices add constraint notification_device_hash_format
  check (token_hash ~ '^[a-f0-9]{64}$') not valid;

alter table public.notification_devices drop constraint if exists notification_device_metadata_lengths;
alter table public.notification_devices add constraint notification_device_metadata_lengths
  check (
    (app_version is null or char_length(app_version) <= 40) and
    (build_version is null or char_length(build_version) <= 40)
  ) not valid;

create unique index if not exists idx_notification_devices_token_hash
  on public.notification_devices(token_hash);
create index if not exists idx_notification_devices_user_enabled
  on public.notification_devices(user_id, enabled, last_seen_at desc);

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

create or replace function public.enforce_notification_push_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.push_enabled and not exists (
    select 1
    from public.notification_devices
    where user_id = new.user_id and enabled = true
  ) then
    new.push_enabled := false;
  end if;
  return new;
end;
$$;

create or replace function public.sync_notification_push_state_after_device_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
  else
    v_user_id := new.user_id;
  end if;

  if v_user_id is not null and not exists (
    select 1
    from public.notification_devices
    where user_id = v_user_id and enabled = true
  ) then
    update public.notification_preferences
    set push_enabled = false
    where user_id = v_user_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_notification_updated_at();

drop trigger if exists notification_preferences_enforce_push_state on public.notification_preferences;
create trigger notification_preferences_enforce_push_state
before insert or update of push_enabled on public.notification_preferences
for each row execute function public.enforce_notification_push_state();

drop trigger if exists notification_devices_set_updated_at on public.notification_devices;
create trigger notification_devices_set_updated_at
before update on public.notification_devices
for each row execute function public.set_notification_updated_at();

drop trigger if exists notification_devices_sync_push_after_delete on public.notification_devices;
create trigger notification_devices_sync_push_after_delete
after delete on public.notification_devices
for each row execute function public.sync_notification_push_state_after_device_change();

drop trigger if exists notification_devices_sync_push_after_enabled_update on public.notification_devices;
create trigger notification_devices_sync_push_after_enabled_update
after update of enabled on public.notification_devices
for each row execute function public.sync_notification_push_state_after_device_change();

drop function if exists public.claim_notification_device(text, text, text, text, text);

create or replace function public.claim_notification_device(
  p_expo_push_token text,
  p_platform text,
  p_app_version text default null,
  p_build_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_id uuid;
  v_token_hash text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_platform not in ('ios', 'android') then
    raise exception 'Unsupported platform';
  end if;

  if p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{20,200}\]$' then
    raise exception 'Invalid push token';
  end if;

  v_token_hash := encode(digest(p_expo_push_token, 'sha256'), 'hex');

  delete from public.notification_devices
  where token_hash = v_token_hash and user_id <> v_user_id;

  insert into public.notification_devices (
    user_id,
    expo_push_token,
    token_hash,
    platform,
    app_version,
    build_version,
    enabled,
    last_seen_at
  ) values (
    v_user_id,
    p_expo_push_token,
    v_token_hash,
    p_platform,
    nullif(left(coalesce(p_app_version, ''), 40), ''),
    nullif(left(coalesce(p_build_version, ''), 40), ''),
    true,
    now()
  )
  on conflict (token_hash) do update set
    user_id = excluded.user_id,
    expo_push_token = excluded.expo_push_token,
    platform = excluded.platform,
    app_version = excluded.app_version,
    build_version = excluded.build_version,
    enabled = true,
    last_seen_at = now()
  returning id into v_device_id;

  return v_device_id;
end;
$$;

alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;
alter table public.notification_devices enable row level security;
alter table public.notification_devices force row level security;

drop policy if exists "Users manage own notification preferences" on public.notification_preferences;
create policy "Users manage own notification preferences"
on public.notification_preferences for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own notification devices" on public.notification_devices;
create policy "Users manage own notification devices"
on public.notification_devices for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on public.notification_preferences from anon;
revoke all on public.notification_devices from anon;
revoke insert, update on public.notification_devices from authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, delete on public.notification_devices to authenticated;

revoke all on function public.claim_notification_device(text, text, text, text) from public;
grant execute on function public.claim_notification_device(text, text, text, text) to authenticated;
