-- Scorecaster Shadow Candidate Trigger Safety V1
-- Avoids any OLD-record dependency on INSERT while preserving wake-up semantics.

create or replace function public.wake_shadow_learning_from_candidate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_should_wake boolean := false;
begin
  if new.settlement_status = 'settled'
     and new.outcome_value in (0, 1)
     and new.model_probability > 0
     and new.model_probability < 1 then
    if tg_op = 'INSERT' then
      v_should_wake := true;
    elsif old.settlement_status is distinct from new.settlement_status
       or old.outcome_value is distinct from new.outcome_value then
      v_should_wake := true;
    end if;
  end if;

  if v_should_wake then
    insert into public.shadow_learning_state (user_id, next_check_at, last_status)
    values (new.user_id, now(), 'idle')
    on conflict (user_id) do update
      set next_check_at = least(public.shadow_learning_state.next_check_at, now()),
          last_status = case when public.shadow_learning_state.last_status = 'running' then 'running' else 'idle' end,
          last_error = null;
  end if;

  return new;
end;
$$;

revoke all on function public.wake_shadow_learning_from_candidate() from public;
grant execute on function public.wake_shadow_learning_from_candidate() to service_role;
