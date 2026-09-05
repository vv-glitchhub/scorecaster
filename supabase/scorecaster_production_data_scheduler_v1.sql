-- Scorecaster Production Data Scheduler V1
-- Independent pg_cron + pg_net scheduler for production data freshness.
-- GitHub Actions remains a fallback. This scheduler never changes probabilities
-- and only invokes the existing paper-only protected workers.

begin;

do $preflight$
begin
  if to_regclass('public.scorecaster_internal_secrets_v1') is null then
    raise exception 'scorecaster_internal_secrets_v1 is missing';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron extension is missing';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net extension is missing';
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'pg_net http_post is unavailable';
  end if;
end;
$preflight$;

insert into public.scorecaster_internal_secrets_v1(name, secret_value)
values ('production_data_pipeline_scheduler', encode(gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

create or replace function scorecaster_private.trigger_production_data_pipeline_task(p_task text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduler_token text;
  request_id bigint;
  target_url text;
begin
  if p_task not in ('collector', 'unified-data', 'sports-analytics') then
    raise exception 'unsupported production data pipeline task';
  end if;

  select secret_value into scheduler_token
  from public.scorecaster_internal_secrets_v1
  where name = 'production_data_pipeline_scheduler';

  if scheduler_token is null or length(scheduler_token) < 32 then
    raise exception 'production data pipeline scheduler token unavailable';
  end if;

  target_url := 'https://scorecaster.vercel.app/api/internal/supabase-scheduler?task=' || p_task;

  select net.http_post(
    url := target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scorecaster-scheduler-token', scheduler_token
    ),
    body := jsonb_build_object(
      'trigger', 'supabase-pg-cron',
      'task', p_task,
      'scheduledAt', now()
    ),
    timeout_milliseconds := 120000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function scorecaster_private.trigger_production_data_pipeline_task(text) from public, anon, authenticated;
grant execute on function scorecaster_private.trigger_production_data_pipeline_task(text) to service_role;

-- Named schedules are idempotent: scheduling the same name overwrites its prior definition.
-- Primary collector every 30 minutes.
select cron.schedule(
  'scorecaster-production-collector-primary-v1',
  '2,32 * * * *',
  $$select scorecaster_private.trigger_production_data_pipeline_task('collector');$$
);

-- Unified Data watchdog every 15 minutes. The bridge checks freshness first and
-- skips provider acquisition while the current capture is still within policy.
select cron.schedule(
  'scorecaster-production-unified-watchdog-v1',
  '7,22,37,52 * * * *',
  $$select scorecaster_private.trigger_production_data_pipeline_task('unified-data');$$
);

-- Normalized analytics every 30 minutes, staggered after collector/unified work.
select cron.schedule(
  'scorecaster-production-sports-analytics-primary-v1',
  '12,42 * * * *',
  $$select scorecaster_private.trigger_production_data_pipeline_task('sports-analytics');$$
);

commit;
