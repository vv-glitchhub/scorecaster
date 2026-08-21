-- Scorecaster authenticated API rate limiter
-- Run after scorecaster_schema.sql and scorecaster_auth_cloud.sql.
-- Safe to run more than once.
--
-- Security boundary:
-- - browser/mobile clients never mutate quota state directly
-- - the application verifies the user JWT first
-- - only the server-side service_role RPC can increment a user's quota bucket

create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_started_at timestamptz not null default clock_timestamp(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, bucket),
  check (char_length(bucket) between 1 and 80)
);

create index if not exists idx_api_rate_limits_updated
  on public.api_rate_limits(updated_at);

alter table public.api_rate_limits enable row level security;
alter table public.api_rate_limits force row level security;

revoke all on public.api_rate_limits from public;
revoke all on public.api_rate_limits from anon;
revoke all on public.api_rate_limits from authenticated;
grant select, insert, update, delete on public.api_rate_limits to service_role;

-- Retire the legacy authenticated SECURITY DEFINER RPC. It accepted caller-supplied
-- limit/window values, which meant a client could directly manipulate its own
-- quota-window semantics outside the reviewed API route.
drop function if exists public.consume_api_quota(text, integer, integer);

create or replace function public.consume_api_quota_for_user(
  p_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
  v_retry_after integer;
begin
  if p_user_id is null then
    raise exception 'User id is required' using errcode = '22023';
  end if;

  if p_bucket is null or p_bucket !~ '^[a-z0-9:_-]{1,80}$' then
    raise exception 'Invalid rate-limit bucket' using errcode = '22023';
  end if;

  if p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit configuration' using errcode = '22023';
  end if;

  insert into public.api_rate_limits as quota (
    user_id,
    bucket,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_user_id, p_bucket, v_now, 1, v_now)
  on conflict (user_id, bucket) do update
  set
    window_started_at = case
      when quota.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then v_now
      else quota.window_started_at
    end,
    request_count = case
      when quota.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then 1
      else quota.request_count + 1
    end,
    updated_at = v_now
  returning window_started_at, request_count
  into v_window_started_at, v_request_count;

  v_retry_after := greatest(
    0,
    ceil(extract(epoch from (
      v_window_started_at + make_interval(secs => p_window_seconds) - v_now
    )))::integer
  );

  return jsonb_build_object(
    'allowed', v_request_count <= p_limit,
    'remaining', greatest(0, p_limit - v_request_count),
    'retryAfter', v_retry_after,
    'limit', p_limit
  );
end;
$$;

revoke all on function public.consume_api_quota_for_user(uuid, text, integer, integer) from public;
revoke all on function public.consume_api_quota_for_user(uuid, text, integer, integer) from anon;
revoke all on function public.consume_api_quota_for_user(uuid, text, integer, integer) from authenticated;
grant execute on function public.consume_api_quota_for_user(uuid, text, integer, integer) to service_role;

-- Remove stale counters during maintenance without retaining user activity
-- longer than needed. This function is server/service-role only.
create or replace function public.delete_stale_api_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_rows integer;
begin
  delete from public.api_rate_limits
  where updated_at < clock_timestamp() - interval '2 days';
  get diagnostics deleted_rows = row_count;
  return deleted_rows;
end;
$$;

revoke all on function public.delete_stale_api_rate_limits() from public;
revoke all on function public.delete_stale_api_rate_limits() from anon;
revoke all on function public.delete_stale_api_rate_limits() from authenticated;
grant execute on function public.delete_stale_api_rate_limits() to service_role;
