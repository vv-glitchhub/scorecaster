-- Scorecaster AI Feed community comments v1
-- Run in the Supabase SQL editor before enabling comments in production.

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  event_id text not null check (char_length(event_id) between 2 and 180),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  message text not null check (char_length(message) between 2 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_comments_event_created_idx
  on public.community_comments (event_id, created_at desc);

create index if not exists community_comments_user_created_idx
  on public.community_comments (user_id, created_at desc);

alter table public.community_comments enable row level security;

revoke all on public.community_comments from anon, authenticated;
grant select on public.community_comments to anon, authenticated;
grant insert, update, delete on public.community_comments to authenticated;

drop policy if exists "Community comments are publicly readable" on public.community_comments;
create policy "Community comments are publicly readable"
  on public.community_comments
  for select
  using (true);

drop policy if exists "Authenticated users can create comments" on public.community_comments;
create policy "Authenticated users can create comments"
  on public.community_comments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own comments" on public.community_comments;
create policy "Users can update their own comments"
  on public.community_comments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.community_comments;
create policy "Users can delete their own comments"
  on public.community_comments
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.community_comments is
  'Authenticated user comments attached to Scorecaster AI Feed event posts.';
