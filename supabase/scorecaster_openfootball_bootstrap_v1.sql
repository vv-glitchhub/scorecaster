create schema if not exists scorecaster_private;
revoke all on schema scorecaster_private from public, anon, authenticated;
grant usage on schema scorecaster_private to service_role;

create or replace function scorecaster_private.trigger_openfootball_mirror(season_start integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cron_token text;
  request_id bigint;
begin
  if season_start < 1990 or season_start > extract(year from now())::integer then
    raise exception 'invalid season_start';
  end if;

  select secret_value into cron_token
  from public.scorecaster_internal_secrets_v1
  where name = 'openfootball_mirror_cron';

  if cron_token is null then
    raise exception 'mirror cron token unavailable';
  end if;

  select net.http_post(
    url := 'https://rsukfxhgqzpofiszjtbf.supabase.co/functions/v1/scorecaster-openfootball-mirror',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-scorecaster-cron-token',cron_token
    ),
    body := jsonb_build_object('trigger','historical-bootstrap','seasonStart',season_start,'time',now()),
    timeout_milliseconds := 60000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function scorecaster_private.trigger_openfootball_mirror(integer) from public, anon, authenticated;
grant execute on function scorecaster_private.trigger_openfootball_mirror(integer) to service_role;