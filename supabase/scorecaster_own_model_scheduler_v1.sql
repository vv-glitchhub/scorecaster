insert into public.scorecaster_internal_secrets_v1(name, secret_value)
values ('own_football_materializer_cron', encode(gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

create or replace function scorecaster_private.trigger_own_football_materializer()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cron_token text;
  request_id bigint;
begin
  select secret_value into cron_token
  from public.scorecaster_internal_secrets_v1
  where name = 'own_football_materializer_cron';
  if cron_token is null then raise exception 'own model cron token unavailable'; end if;

  select net.http_post(
    url := 'https://rsukfxhgqzpofiszjtbf.supabase.co/functions/v1/scorecaster-own-football-materializer',
    headers := jsonb_build_object('Content-Type','application/json','x-scorecaster-cron-token',cron_token),
    body := jsonb_build_object('trigger','pg_cron','time',now()),
    timeout_milliseconds := 60000
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function scorecaster_private.trigger_own_football_materializer() from public, anon, authenticated;
grant execute on function scorecaster_private.trigger_own_football_materializer() to service_role;

select cron.schedule(
  'scorecaster-own-football-materializer-6h',
  '40 */6 * * *',
  $$select scorecaster_private.trigger_own_football_materializer();$$
);

-- Production data freshness has an independent Supabase-owned scheduler so a
-- delayed GitHub Actions schedule cannot make Collector or Sports Analytics stale.
-- The generated token stays in the existing fail-closed server-only secret table.
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

  target_url := 'https://scorecaster.vercel.app/api/internal/collector/maintenance?task=' || p_task;

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

select cron.schedule(
  'scorecaster-production-collector-primary-v1',
  '2,32 * * * *',
  $$select scorecaster_private.trigger_production_data_pipeline_task('collector');$$
);

-- This watchdog runs every 15 minutes but the application bridge first checks
-- the 15-minute freshness policy and skips the expensive worker while data is fresh.
select cron.schedule(
  'scorecaster-production-unified-watchdog-v1',
  '7,22,37,52 * * * *',
  $$select scorecaster_private.trigger_production_data_pipeline_task('unified-data');$$
);

select cron.schedule(
  'scorecaster-production-sports-analytics-primary-v1',
  '12,42 * * * *',
  $$select scorecaster_private.trigger_production_data_pipeline_task('sports-analytics');$$
);