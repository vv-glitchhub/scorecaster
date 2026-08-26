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