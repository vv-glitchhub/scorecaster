create table if not exists public.intelligence_items (
 id uuid primary key default gen_random_uuid(),
 event_id text not null,
 team text,
 category text not null check (category in ('news','injury','lineup','travel','rest','weather','coach','official','market')),
 title text,
 summary text,
 source_id text not null,
 source_name text not null,
 source_type text not null,
 source_url text,
 canonical_url text,
 published_at timestamptz not null,
 observed_at timestamptz not null default now(),
 direction numeric not null default 0 check (direction between -1 and 1),
 severity numeric not null default 0.5 check (severity between 0 and 1),
 relevance numeric not null default 0.5 check (relevance between 0 and 1),
 confidence numeric not null default 0.5 check (confidence between 0 and 1),
 source_trust numeric not null default 0.5 check (source_trust between 0 and 1),
 used_because text,
 raw_payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique(event_id, source_id, canonical_url)
);

create index if not exists intelligence_items_event_idx on public.intelligence_items(event_id, published_at desc);
create index if not exists intelligence_items_category_idx on public.intelligence_items(category, published_at desc);

alter table public.intelligence_items enable row level security;

create table if not exists public.intelligence_reports (
 id uuid primary key default gen_random_uuid(),
 event_id text not null,
 base_home_probability numeric,
 adjusted_home_probability numeric,
 total_impact_probability numeric,
 data_quality numeric,
 report jsonb not null,
 generated_at timestamptz not null default now()
);

create index if not exists intelligence_reports_event_idx on public.intelligence_reports(event_id, generated_at desc);
alter table public.intelligence_reports enable row level security;

comment on table public.intelligence_items is 'Auditable signals used by Scorecaster AI decision support. No automatic bet execution.';
comment on table public.intelligence_reports is 'Human-facing intelligence reports with sources, reasons, uncertainty and probability impact.';
