-- Scorecaster Notification Delivery V1
-- Run after scorecaster_notification_registry.sql and scorecaster_alert_inbox.sql.
-- Safe to run more than once. Delivery stays disabled until server configuration is complete.

create extension if not exists pgcrypto;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null references public.alert_inbox(id) on delete cascade,
  device_id uuid not null references public.notification_devices(id) on delete cascade,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  expo_ticket_id text,
  ticket_status text,
  receipt_status text,
  error_code text,
  error_message text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  receipt_checked_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_deliveries add column if not exists attempt_count integer not null default 0;
alter table public.notification_deliveries add column if not exists next_attempt_at timestamptz not null default now();
alter table public.notification_deliveries add column if not exists lease_expires_at timestamptz;
alter table public.notification_deliveries add column if not exists expo_ticket_id text;
alter table public.notification_deliveries add column if not exists ticket_status text;
alter table public.notification_deliveries add column if not exists receipt_status text;
alter table public.notification_deliveries add column if not exists error_code text;
alter table public.notification_deliveries add column if not exists error_message text;
alter table public.notification_deliveries add column if not exists queued_at timestamptz not null default now();
alter table public.notification_deliveries add column if not exists sent_at timestamptz;
alter table public.notification_deliveries add column if not exists receipt_checked_at timestamptz;
alter table public.notification_deliveries add column if not exists delivered_at timestamptz;
alter table public.notification_deliveries add column if not exists failed_at timestamptz;
alter table public.notification_deliveries add column if not exists updated_at timestamptz not null default now();

alter table public.notification_deliveries drop constraint if exists notification_delivery_status_allowed;
alter table public.notification_deliveries add constraint notification_delivery_status_allowed
  check (status in ('queued', 'sending', 'retry', 'ticketed', 'delivered', 'failed')) not valid;

alter table public.notification_deliveries drop constraint if exists notification_delivery_attempt_bounds;
alter table public.notification_deliveries add constraint notification_delivery_attempt_bounds
  check (attempt_count between 0 and 5) not valid;

alter table public.notification_deliveries drop constraint if exists notification_delivery_text_lengths;
alter table public.notification_deliveries add constraint notification_delivery_text_lengths
  check (
    (expo_ticket_id is null or char_length(expo_ticket_id) <= 180) and
    (ticket_status is null or char_length(ticket_status) <= 40) and
    (receipt_status is null or char_length(receipt_status) <= 40) and
    (error_code is null or char_length(error_code) <= 80) and
    (error_message is null or char_length(error_message) <= 500)
  ) not valid;

create unique index if not exists idx_notification_deliveries_alert_device
  on public.notification_deliveries(alert_id, device_id);
create index if not exists idx_notification_deliveries_due
  on public.notification_deliveries(status, next_attempt_at, lease_expires_at);
create index if not exists idx_notification_deliveries_receipts
  on public.notification_deliveries(status, sent_at, receipt_checked_at)
  where expo_ticket_id is not null;
create index if not exists idx_notification_deliveries_user
  on public.notification_deliveries(user_id, created_at desc);

create or replace function public.set_notification_delivery_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_deliveries_set_updated_at on public.notification_deliveries;
create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row execute function public.set_notification_delivery_updated_at();

create or replace function public.claim_notification_deliveries(p_limit integer default 100)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with claimed as (
    select id
    from public.notification_deliveries
    where attempt_count < 5
      and (
        (status in ('queued', 'retry') and next_attempt_at <= now())
        or (status = 'sending' and lease_expires_at < now())
      )
    order by next_attempt_at asc, created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 100))
  )
  update public.notification_deliveries d
  set status = 'sending',
      attempt_count = least(d.attempt_count + 1, 5),
      lease_expires_at = now() + interval '5 minutes',
      error_code = null,
      error_message = null
  from claimed
  where d.id = claimed.id
  returning d.*;
end;
$$;

alter table public.notification_deliveries enable row level security;
alter table public.notification_deliveries force row level security;

drop policy if exists "Users read own notification delivery metadata" on public.notification_deliveries;
create policy "Users read own notification delivery metadata"
on public.notification_deliveries for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.notification_deliveries from anon;
revoke insert, update, delete on public.notification_deliveries from authenticated;
grant select on public.notification_deliveries to authenticated;
revoke all on function public.claim_notification_deliveries(integer) from public;
grant execute on function public.claim_notification_deliveries(integer) to service_role;
