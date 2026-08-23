\set ON_ERROR_STOP on

-- Read-only verification for the Shadow Candidate settlement schema and ACL boundary.

do $$
declare
  missing_columns text[];
begin
  if to_regclass('public.shadow_candidate_settlement_runs_v1') is null then
    raise exception 'Shadow Candidate settlement run table is missing';
  end if;

  select array_agg(expected.column_name order by expected.column_name)
  into missing_columns
  from unnest(array[
    'market', 'commence_time', 'model_version', 'entry_market_probability',
    'model_probability', 'settlement_status', 'result', 'outcome_value',
    'settled_at', 'closing_consensus_probability', 'closing_fair_odds',
    'closing_provider_count', 'closing_captured_at', 'price_clv',
    'probability_clv', 'brier_score', 'log_loss', 'result_source',
    'settlement_attempts', 'exclusion_reason', 'learning_mode', 'shadow_only',
    'production_probability_changed', 'automatic_promotion_allowed',
    'real_money_execution'
  ]) as expected(column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'autonomous_agent_decision_audit'
      and c.column_name = expected.column_name
  );

  if missing_columns is not null then
    raise exception 'Shadow Candidate audit columns are missing: %', array_to_string(missing_columns, ', ');
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'shadow_candidate_settlement_runs_v1'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ) then
    raise exception 'Shadow Candidate settlement run table must use RLS and FORCE RLS';
  end if;

  if has_table_privilege('anon', 'public.shadow_candidate_settlement_runs_v1', 'SELECT')
     or has_table_privilege('anon', 'public.shadow_candidate_settlement_runs_v1', 'INSERT')
     or has_table_privilege('anon', 'public.shadow_candidate_settlement_runs_v1', 'UPDATE')
     or has_table_privilege('anon', 'public.shadow_candidate_settlement_runs_v1', 'DELETE')
     or has_table_privilege('authenticated', 'public.shadow_candidate_settlement_runs_v1', 'SELECT')
     or has_table_privilege('authenticated', 'public.shadow_candidate_settlement_runs_v1', 'INSERT')
     or has_table_privilege('authenticated', 'public.shadow_candidate_settlement_runs_v1', 'UPDATE')
     or has_table_privilege('authenticated', 'public.shadow_candidate_settlement_runs_v1', 'DELETE') then
    raise exception 'Shadow Candidate settlement runs must remain service-role only';
  end if;

  if to_regprocedure('public.set_shadow_candidate_observation_defaults()') is null
     or to_regprocedure('public.wake_shadow_learning_from_candidate()') is null
     or to_regprocedure('public.apply_shadow_candidate_settlements_v1(jsonb)') is null then
    raise exception 'A Shadow Candidate helper function is missing';
  end if;

  if has_function_privilege('anon', 'public.set_shadow_candidate_observation_defaults()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.set_shadow_candidate_observation_defaults()', 'EXECUTE')
     or has_function_privilege('anon', 'public.wake_shadow_learning_from_candidate()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.wake_shadow_learning_from_candidate()', 'EXECUTE')
     or has_function_privilege('anon', 'public.apply_shadow_candidate_settlements_v1(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.apply_shadow_candidate_settlements_v1(jsonb)', 'EXECUTE') then
    raise exception 'anon or authenticated can execute a Shadow Candidate helper function';
  end if;

  if not has_function_privilege('service_role', 'public.set_shadow_candidate_observation_defaults()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.wake_shadow_learning_from_candidate()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.apply_shadow_candidate_settlements_v1(jsonb)', 'EXECUTE') then
    raise exception 'service_role cannot execute a required Shadow Candidate helper function';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'autonomous_audit_shadow_defaults' and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgname = 'autonomous_audit_wake_shadow_learning' and not tgisinternal
  ) then
    raise exception 'A Shadow Candidate trigger is missing';
  end if;
end;
$$;

select json_build_object(
  'ok', true,
  'version', 'scorecaster-shadow-candidate-schema-verification-v1',
  'settlementRunsServiceOwned', true,
  'helperFunctionsServiceRoleOnly', true,
  'paperOnly', true,
  'automaticModelPromotion', false,
  'realMoneyExecution', false,
  'verifiedAt', now()
) as shadow_candidate_schema;
