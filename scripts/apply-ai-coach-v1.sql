-- Scorecaster AI Coach V1 production patch
-- Safe to run more than once in Supabase SQL Editor.
-- Stores user-controlled coaching preferences and immutable paper-only reports.

begin;

create extension if not exists pgcrypto;

create table if not exists public.ai_coach_preferences_v1 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  notifications_enabled boolean not null default false,
  quiet_start time,
  quiet_end time,
  max_notifications_per_week integer not null default 2 check (max_notifications_per_week between 0 and 7),
  minimum_sample integer not null default 20 check (minimum_sample between 10 and 500),
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_coach_reports_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_version text not null,
  window_days integer not null check (window_days between 7 and 1825),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  report jsonb not null,
  generated_at timestamptz not null,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  constraint ai_coach_reports_v1_user_version_generated_unique unique (user_id, report_version, generated_at)
);

create index if not exists ai_coach_reports_v1_user_generated_idx
  on public.ai_coach_reports_v1(user_id, generated_at desc);

create or replace function public.ai_coach_set_updated_at_v1()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.ai_coach_set_updated_at_v1() from public, anon, authenticated;

drop trigger if exists ai_coach_preferences_v1_updated_at on public.ai_coach_preferences_v1;
create trigger ai_coach_preferences_v1_updated_at
before update on public.ai_coach_preferences_v1
for each row execute function public.ai_coach_set_updated_at_v1();

alter table public.ai_coach_preferences_v1 enable row level security;
alter table public.ai_coach_preferences_v1 force row level security;
alter table public.ai_coach_reports_v1 enable row level security;
alter table public.ai_coach_reports_v1 force row level security;

drop policy if exists "Users read own AI Coach preferences" on public.ai_coach_preferences_v1;
create policy "Users read own AI Coach preferences"
on public.ai_coach_preferences_v1 for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own AI Coach preferences" on public.ai_coach_preferences_v1;
create policy "Users insert own AI Coach preferences"
on public.ai_coach_preferences_v1 for insert
to authenticated
with check (auth.uid() = user_id and paper_only = true);

drop policy if exists "Users update own AI Coach preferences" on public.ai_coach_preferences_v1;
create policy "Users update own AI Coach preferences"
on public.ai_coach_preferences_v1 for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and paper_only = true);

drop policy if exists "Users delete own AI Coach preferences" on public.ai_coach_preferences_v1;
create policy "Users delete own AI Coach preferences"
on public.ai_coach_preferences_v1 for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own AI Coach reports" on public.ai_coach_reports_v1;
create policy "Users read own AI Coach reports"
on public.ai_coach_reports_v1 for select
to authenticated
using (auth.uid() = user_id);

revoke all privileges on table public.ai_coach_preferences_v1 from public, anon;
revoke all privileges on table public.ai_coach_reports_v1 from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_coach_preferences_v1 to authenticated;
grant select on table public.ai_coach_reports_v1 to authenticated;
grant all privileges on table public.ai_coach_preferences_v1 to service_role;
grant all privileges on table public.ai_coach_reports_v1 to service_role;

comment on table public.ai_coach_preferences_v1 is
  'User-controlled AI Coach enablement, quiet hours and bounded notification frequency. Paper-only.';
comment on table public.ai_coach_reports_v1 is
  'Server-generated evidence report based only on the authenticated user paper records and public model evidence.';
comment on column public.ai_coach_reports_v1.report is
  'Structured audit JSON. Cannot modify model probability, automatic decisions or stakes.';

commit;

notify pgrst, 'reload schema';
