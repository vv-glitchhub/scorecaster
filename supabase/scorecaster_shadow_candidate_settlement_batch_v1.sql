-- Scorecaster Shadow Candidate Settlement Batch V1
-- Service-role-only batch updater used by the protected settlement worker.

create or replace function public.apply_shadow_candidate_settlements_v1(p_rows jsonb)
returns table(id uuid, user_id uuid, settlement_status text, outcome_value integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'p_rows exceeds the 1000 row batch limit';
  end if;

  return query
  with payload as (
    select *
    from jsonb_to_recordset(p_rows) as x(
      id uuid,
      settlement_status text,
      result text,
      outcome_value integer,
      commence_time timestamptz,
      settled_at timestamptz,
      closing_consensus_probability numeric,
      closing_fair_odds numeric,
      closing_provider_count integer,
      closing_captured_at timestamptz,
      price_clv numeric,
      probability_clv numeric,
      brier_score numeric,
      log_loss numeric,
      result_source text,
      exclusion_reason text
    )
  ), validated as (
    select *
    from payload
    where id is not null
      and settlement_status in ('open', 'settled', 'void', 'excluded')
      and (result is null or result in ('win', 'loss', 'push', 'void'))
      and (outcome_value is null or outcome_value in (0, 1))
  ), updated as (
    update public.autonomous_agent_decision_audit audit
    set settlement_status = validated.settlement_status,
        result = validated.result,
        outcome_value = validated.outcome_value,
        commence_time = coalesce(audit.commence_time, validated.commence_time),
        settled_at = validated.settled_at,
        closing_consensus_probability = validated.closing_consensus_probability,
        closing_fair_odds = validated.closing_fair_odds,
        closing_provider_count = greatest(0, coalesce(validated.closing_provider_count, 0)),
        closing_captured_at = validated.closing_captured_at,
        price_clv = validated.price_clv,
        probability_clv = validated.probability_clv,
        brier_score = validated.brier_score,
        log_loss = validated.log_loss,
        result_source = nullif(left(coalesce(validated.result_source, ''), 120), ''),
        exclusion_reason = nullif(left(coalesce(validated.exclusion_reason, ''), 240), ''),
        last_settlement_attempt_at = now(),
        settlement_attempts = audit.settlement_attempts + 1,
        learning_mode = 'shadow-only',
        shadow_only = true,
        production_probability_changed = false,
        automatic_promotion_allowed = false,
        real_money_execution = false
    from validated
    where audit.id = validated.id
      and audit.settlement_status in ('open', 'excluded')
    returning audit.id, audit.user_id, audit.settlement_status, audit.outcome_value
  )
  select updated.id, updated.user_id, updated.settlement_status, updated.outcome_value
  from updated;
end;
$$;

revoke all on function public.apply_shadow_candidate_settlements_v1(jsonb) from public, anon, authenticated;
grant execute on function public.apply_shadow_candidate_settlements_v1(jsonb) to service_role;
