-- Secure server-only triggers for Scorecaster owned intelligence workers.

create or replace function scorecaster_private.trigger_own_football_trainer()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://rsukfxhgqzpofiszjtbf.supabase.co/functions/v1/scorecaster-own-football-trainer',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-scorecaster-cron-token',(select secret_value from public.scorecaster_internal_secrets_v1 where name='own_football_trainer_cron')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$;

create or replace function scorecaster_private.trigger_own_football_ml_materializer()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://rsukfxhgqzpofiszjtbf.supabase.co/functions/v1/scorecaster-own-football-ml-materializer',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-scorecaster-cron-token',(select secret_value from public.scorecaster_internal_secrets_v1 where name='own_football_ml_materializer_cron')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$;

create or replace function scorecaster_private.trigger_own_decision_engine()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://rsukfxhgqzpofiszjtbf.supabase.co/functions/v1/scorecaster-own-decision-engine',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-scorecaster-cron-token',(select secret_value from public.scorecaster_internal_secrets_v1 where name='own_decision_engine_cron')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$;

revoke all on function scorecaster_private.trigger_own_football_trainer() from public, anon, authenticated;
revoke all on function scorecaster_private.trigger_own_football_ml_materializer() from public, anon, authenticated;
revoke all on function scorecaster_private.trigger_own_decision_engine() from public, anon, authenticated;
grant execute on function scorecaster_private.trigger_own_football_trainer() to service_role;
grant execute on function scorecaster_private.trigger_own_football_ml_materializer() to service_role;
grant execute on function scorecaster_private.trigger_own_decision_engine() to service_role;
