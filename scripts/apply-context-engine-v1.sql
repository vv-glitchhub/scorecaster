-- Scorecaster Context Engine V1
-- Server-only, append-oriented pre-match context evidence.
-- This patch does not remove or rewrite existing application data.

begin;

create table if not exists public.context_evidence_v1 (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  sport text,
  league text,
  kickoff_at timestamptz not null,
  team_role text not null check (team_role in ('home', 'away', 'event')),
  team text,
  category text not null check (category in (
    'lineup', 'injury', 'suspension', 'availability', 'rest', 'travel',
    'weather', 'surface', 'official'
  )),
  subject text not null,
  status text not null,
  confirmation text not null check (confirmation in ('confirmed', 'probable', 'unconfirmed', 'rumor')),
  impact numeric not null default 0 check (impact >= -1 and impact <= 1),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  source_trust numeric not null default 0.5 check (source_trust >= 0 and source_trust <= 1),
  source_id text not null,
  observed_at timestamptz not null,
  effective_at timestamptz,
  expires_at timestamptz,
  supersedes_id uuid references public.context_evidence_v1(id) on delete set null,
  public_note text,
  source_reference text,
  created_at timestamptz not null default now(),
  constraint context_evidence_v1_observed_before_kickoff check (observed_at < kickoff_at),
  constraint context_evidence_v1_effective_before_kickoff check (effective_at is null or effective_at <= kickoff_at),
  constraint context_evidence_v1_expiry_order check (expires_at is null or expires_at > observed_at)
);

create index if not exists context_evidence_v1_event_idx
  on public.context_evidence_v1(event_id, observed_at desc);

create index if not exists context_evidence_v1_event_category_idx
  on public.context_evidence_v1(event_id, category, team_role, subject);

create index if not exists context_evidence_v1_source_idx
  on public.context_evidence_v1(source_id, observed_at desc);

create index if not exists context_evidence_v1_supersedes_idx
  on public.context_evidence_v1(supersedes_id)
  where supersedes_id is not null;

alter table public.context_evidence_v1 enable row level security;
alter table public.context_evidence_v1 force row level security;

revoke all privileges on table public.context_evidence_v1 from public, anon, authenticated;
grant all privileges on table public.context_evidence_v1 to service_role;

comment on table public.context_evidence_v1 is
  'Timestamped, server-only pre-match context evidence. Corrections append a new row and may reference supersedes_id.';
comment on column public.context_evidence_v1.impact is
  'Normalized bounded direction from -1 to 1. The application applies category-specific caps; this is not a probability.';
comment on column public.context_evidence_v1.confirmation is
  'Evidence state. Unconfirmed and rumor rows must never be displayed as confirmed.';

commit;

notify pgrst, 'reload schema';
