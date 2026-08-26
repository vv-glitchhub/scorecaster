create table if not exists public.scorecaster_event_identity_map_v1 (
  id uuid primary key default gen_random_uuid(),
  canonical_event_id text not null,
  source_id text not null,
  source_event_id text not null,
  sport_key text not null,
  league text,
  home_team text,
  away_team text,
  commence_time timestamptz,
  mapping_method text not null,
  match_confidence numeric not null default 0.5 check (match_confidence >= 0 and match_confidence <= 1),
  verified boolean not null default false,
  lineage jsonb not null default '{}'::jsonb,
  paper_only boolean not null default true check (paper_only = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, source_event_id)
);
create index if not exists scorecaster_event_identity_canonical_idx
  on public.scorecaster_event_identity_map_v1 (canonical_event_id, updated_at desc);
create index if not exists scorecaster_event_identity_match_idx
  on public.scorecaster_event_identity_map_v1 (sport_key, commence_time, home_team, away_team);
alter table public.scorecaster_event_identity_map_v1 enable row level security;
alter table public.scorecaster_event_identity_map_v1 force row level security;
revoke all on public.scorecaster_event_identity_map_v1 from anon, authenticated;
grant all on public.scorecaster_event_identity_map_v1 to service_role;