-- Scorecaster authenticated RPC boundaries V1
--
-- Public Data API functions remain stable SECURITY INVOKER wrappers. Their
-- narrowly scoped privileged implementations live in the unexposed
-- scorecaster_private schema and continue to bind every mutation to auth.uid().

begin;

create schema if not exists scorecaster_private;
revoke all on schema scorecaster_private from public, anon;
grant usage on schema scorecaster_private to authenticated, service_role;

do $migration$
begin
  if to_regprocedure('scorecaster_private.claim_notification_device_impl(text,text,text,text)') is null then
    if to_regprocedure('public.claim_notification_device(text,text,text,text)') is null then
      raise exception 'claim_notification_device source RPC is missing';
    end if;
    alter function public.claim_notification_device(text, text, text, text) set schema scorecaster_private;
    alter function scorecaster_private.claim_notification_device(text, text, text, text) rename to claim_notification_device_impl;
  end if;

  if to_regprocedure('scorecaster_private.request_autonomous_agent_run_impl()') is null then
    if to_regprocedure('public.request_autonomous_agent_run()') is null then
      raise exception 'request_autonomous_agent_run source RPC is missing';
    end if;
    alter function public.request_autonomous_agent_run() set schema scorecaster_private;
    alter function scorecaster_private.request_autonomous_agent_run() rename to request_autonomous_agent_run_impl;
  end if;

  if to_regprocedure('scorecaster_private.set_auto_watch_recommendation_preferences_impl(boolean,integer,numeric,integer)') is null then
    if to_regprocedure('public.set_auto_watch_recommendation_preferences(boolean,integer,numeric,integer)') is null then
      raise exception 'set_auto_watch_recommendation_preferences source RPC is missing';
    end if;
    alter function public.set_auto_watch_recommendation_preferences(boolean, integer, numeric, integer) set schema scorecaster_private;
    alter function scorecaster_private.set_auto_watch_recommendation_preferences(boolean, integer, numeric, integer) rename to set_auto_watch_recommendation_preferences_impl;
  end if;

  if to_regprocedure('scorecaster_private.set_auto_watch_recommendation_preferences_v2_impl(boolean,integer,numeric,integer,text,numeric,numeric,numeric,text[])') is null then
    if to_regprocedure('public.set_auto_watch_recommendation_preferences_v2(boolean,integer,numeric,integer,text,numeric,numeric,numeric,text[])') is null then
      raise exception 'set_auto_watch_recommendation_preferences_v2 source RPC is missing';
    end if;
    alter function public.set_auto_watch_recommendation_preferences_v2(boolean, integer, numeric, integer, text, numeric, numeric, numeric, text[]) set schema scorecaster_private;
    alter function scorecaster_private.set_auto_watch_recommendation_preferences_v2(boolean, integer, numeric, integer, text, numeric, numeric, numeric, text[]) rename to set_auto_watch_recommendation_preferences_v2_impl;
  end if;
end;
$migration$;

alter function scorecaster_private.claim_notification_device_impl(text, text, text, text)
  security definer set search_path = pg_catalog, public, extensions;
alter function scorecaster_private.request_autonomous_agent_run_impl()
  security definer set search_path = pg_catalog, public;
alter function scorecaster_private.set_auto_watch_recommendation_preferences_impl(boolean, integer, numeric, integer)
  security definer set search_path = pg_catalog, public;
alter function scorecaster_private.set_auto_watch_recommendation_preferences_v2_impl(boolean, integer, numeric, integer, text, numeric, numeric, numeric, text[])
  security definer set search_path = pg_catalog, public;

revoke all privileges on function scorecaster_private.claim_notification_device_impl(text, text, text, text) from public, anon, service_role;
revoke all privileges on function scorecaster_private.request_autonomous_agent_run_impl() from public, anon, service_role;
revoke all privileges on function scorecaster_private.set_auto_watch_recommendation_preferences_impl(boolean, integer, numeric, integer) from public, anon, service_role;
revoke all privileges on function scorecaster_private.set_auto_watch_recommendation_preferences_v2_impl(boolean, integer, numeric, integer, text, numeric, numeric, numeric, text[]) from public, anon, service_role;

grant execute on function scorecaster_private.claim_notification_device_impl(text, text, text, text) to authenticated;
grant execute on function scorecaster_private.request_autonomous_agent_run_impl() to authenticated;
grant execute on function scorecaster_private.set_auto_watch_recommendation_preferences_impl(boolean, integer, numeric, integer) to authenticated;
grant execute on function scorecaster_private.set_auto_watch_recommendation_preferences_v2_impl(boolean, integer, numeric, integer, text, numeric, numeric, numeric, text[]) to authenticated;

create or replace function public.claim_notification_device(
  p_expo_push_token text,
  p_platform text,
  p_app_version text default null,
  p_build_version text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, scorecaster_private
as $$
  select scorecaster_private.claim_notification_device_impl($1, $2, $3, $4);
$$;

create or replace function public.request_autonomous_agent_run()
returns boolean
language sql
security invoker
set search_path = pg_catalog, scorecaster_private
as $$
  select scorecaster_private.request_autonomous_agent_run_impl();
$$;

create or replace function public.set_auto_watch_recommendation_preferences(
  p_enabled boolean,
  p_top_n integer default 3,
  p_alert_move_percent numeric default 0.03,
  p_alert_before_minutes integer default 120
)
returns public.auto_watch_recommendation_preferences
language sql
security invoker
set search_path = pg_catalog, scorecaster_private, public
as $$
  select *
  from scorecaster_private.set_auto_watch_recommendation_preferences_impl($1, $2, $3, $4);
$$;

create or replace function public.set_auto_watch_recommendation_preferences_v2(
  p_enabled boolean,
  p_top_n integer default 3,
  p_alert_move_percent numeric default 0.03,
  p_alert_before_minutes integer default 120,
  p_selection_mode text default 'play-and-caution',
  p_min_score numeric default 0,
  p_min_edge numeric default 0,
  p_min_ev numeric default 0,
  p_sport_keys text[] default '{}'::text[]
)
returns public.auto_watch_recommendation_preferences
language sql
security invoker
set search_path = pg_catalog, scorecaster_private, public
as $$
  select *
  from scorecaster_private.set_auto_watch_recommendation_preferences_v2_impl($1, $2, $3, $4, $5, $6, $7, $8, $9);
$$;

revoke all privileges on function public.claim_notification_device(text, text, text, text) from public, anon, service_role;
revoke all privileges on function public.request_autonomous_agent_run() from public, anon, service_role;
revoke all privileges on function public.set_auto_watch_recommendation_preferences(boolean, integer, numeric, integer) from public, anon, service_role;
revoke all privileges on function public.set_auto_watch_recommendation_preferences_v2(boolean, integer, numeric, integer, text, numeric, numeric, numeric, text[]) from public, anon, service_role;

grant execute on function public.claim_notification_device(text, text, text, text) to authenticated;
grant execute on function public.request_autonomous_agent_run() to authenticated;
grant execute on function public.set_auto_watch_recommendation_preferences(boolean, integer, numeric, integer) to authenticated;
grant execute on function public.set_auto_watch_recommendation_preferences_v2(boolean, integer, numeric, integer, text, numeric, numeric, numeric, text[]) to authenticated;

commit;

notify pgrst, 'reload schema';
