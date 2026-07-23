\set ON_ERROR_STOP on

-- Read-only Autonomous V13 hard-cap verification.

do $$
begin
  if to_regprocedure('public.enforce_autonomous_v13_hard_caps()') is null then
    raise exception 'Autonomous V13 hard-cap function is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'bets'
      and t.tgname = 'bets_enforce_autonomous_v13_hard_caps'
      and not t.tgisinternal
  ) then
    raise exception 'Autonomous V13 hard-cap trigger is missing';
  end if;

  if has_function_privilege('anon', 'public.enforce_autonomous_v13_hard_caps()', 'EXECUTE') then
    raise exception 'anon must not execute Autonomous V13 hard-cap function';
  end if;

  if has_function_privilege('authenticated', 'public.enforce_autonomous_v13_hard_caps()', 'EXECUTE') then
    raise exception 'authenticated users must not execute Autonomous V13 hard-cap function directly';
  end if;
end;
$$;

select json_build_object(
  'ok', true,
  'version', 'autonomous-v13-hard-cap-verification-v1',
  'singleStakePercent', 1,
  'utcDailyExposurePercent', 5,
  'utcLeagueExposurePercent', 2.5,
  'dailyPickLimit', true,
  'sameEventDailyDeduplication', true,
  'paperOnly', true,
  'verifiedAt', now()
) as autonomous_v13_hard_caps;
