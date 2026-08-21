-- Scorecaster Shadow Candidate Observations V1
-- Extends the existing autonomous decision audit into a paper-only learning source.
-- Rejected candidates remain observations only: they are never inserted into bets and
-- cannot change production probabilities, auto-promote a model, or execute real money.
-- Run after scorecaster_autonomous_agent_v2.sql, scorecaster_shadow_learning_v1.sql,
-- and the Market Microstructure V2 production patch.

create extension if not exists pgcrypto;

alter table public.autonomous_agent_decision_audit
  add column if not exists market text not null default 'h2h',
  add column if not exists bookmaker text,
  add column if not exists commence_time timestamptz,
  add column if not exists model_version text not null default 'Autonomous-Scorecaster-V13',
  add column if not exists entry_market_probability numeric,
  add column if not exists model_probability numeric,
  add column if not exists settlement_status text not null default 'open',
  add column if not exists result text,
  add column if not exists outcome_value integer,
  add column if not exists settled_at timestamptz,
  add column if not exists closing_consensus_probability numeric,
  add column if not exists closing_fair_odds numeric,
  add column if not exists closing_provider_count integer not null default 0,
  add column if not exists closing_captured_at timestamptz,
  add column if not exists price_clv numeric,
  add column if not exists probability_clv numeric,
  add column if not exists brier_score numeric,
  add column if not exists log_loss numeric,
  add column if not exists result_source text,
  add column if not exists last_settlement_attempt_at timestamptz,
  add column if not exists settlement_attempts integer not null default 0,
  add column if not exists exclusion_reason text,
  add column if not exists learning_mode text not null default 'shadow-only',
  add column if not exists shadow_only boolean not null default true,
  add column if not exists production_probability_changed boolean not null default false,
  add column if not exists automatic_promotion_allowed boolean not null default false,
  add column if not exists real_money_execution boolean not null default false;

-- Edge in Scorecaster is model_probability - (1 / decimal_odds). This preserves the
-- exact probability already used by the decision engine without inventing a new model.
update public.autonomous_agent_decision_audit
set entry_market_probability = case
      when odds > 1 then 1 / odds
      else entry_market_probability
    end,
    model_probability = case
      when odds > 1 and edge is not null and (1 / odds + edge) > 0 and (1 / odds + edge) < 1
        then 1 / odds + edge
      else model_probability
    end,
    commence_time = coalesce(
      commence_time,
      (
        select min(snapshot.commence_time)
        from public.market_provider_snapshots_v2 snapshot
        where snapshot.event_id = autonomous_agent_decision_audit.event_id
      )
    ),
    learning_mode = 'shadow-only',
    shadow_only = true,
    production_probability_changed = false,
    automatic_promotion_allowed = false,
    real_money_execution = false
where entry_market_probability is null
   or model_probability is null
   or commence_time is null
   or learning_mode <> 'shadow-only'
   or shadow_only is distinct from true
   or production_probability_changed is distinct from false
   or automatic_promotion_allowed is distinct from false
   or real_money_execution is distinct from false;

alter table public.autonomous_agent_decision_audit
  drop constraint if exists autonomous_agent_decision_audit_shadow_probability_range;
alter table public.autonomous_agent_decision_audit
  add constraint autonomous_agent_decision_audit_shadow_probability_range
  check (
    (entry_market_probability is null or entry_market_probability > 0 and entry_market_probability < 1) and
    (model_probability is null or model_probability > 0 and model_probability < 1) and
    (closing_consensus_probability is null or closing_consensus_probability > 0 and closing_consensus_probability < 1)
  ) not valid;

alter table public.autonomous_agent_decision_audit
  drop constraint if exists autonomous_agent_decision_audit_shadow_settlement_allowed;
alter table public.autonomous_agent_decision_audit
  add constraint autonomous_agent_decision_audit_shadow_settlement_allowed
  check (
    settlement_status in ('open', 'settled', 'void', 'excluded') and
    (result is null or result in ('win', 'loss', 'push', 'void')) and
    (outcome_value is null or outcome_value in (0, 1)) and
    closing_provider_count >= 0 and
    settlement_attempts >= 0
  ) not valid;

alter table public.autonomous_agent_decision_audit
  drop constraint if exists autonomous_agent_decision_audit_shadow_safety_boundary;
alter table public.autonomous_agent_decision_audit
  add constraint autonomous_agent_decision_audit_shadow_safety_boundary
  check (
    learning_mode = 'shadow-only' and
    shadow_only = true and
    production_probability_changed = false and
    automatic_promotion_allowed = false and
    real_money_execution = false
  ) not valid;

create index if not exists idx_autonomous_audit_shadow_user_status
  on public.autonomous_agent_decision_audit(user_id, settlement_status, created_at desc);
create index if not exists idx_autonomous_audit_shadow_event_status
  on public.autonomous_agent_decision_audit(event_id, settlement_status, created_at desc);
create index if not exists idx_autonomous_audit_shadow_commence
  on public.autonomous_agent_decision_audit(settlement_status, commence_time)
  where settlement_status = 'open';

create table if not exists public.shadow_candidate_settlement_runs_v1 (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',
  candidates_seen integer not null default 0,
  settled_count integer not null default 0,
  pending_count integer not null default 0,
  excluded_count integer not null default 0,
  closing_count integer not null default 0,
  provider_warning_count integer not null default 0,
  diagnostics jsonb not null default '[]'::jsonb,
  paper_only boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.shadow_candidate_settlement_runs_v1
  drop constraint if exists shadow_candidate_settlement_run_status_allowed;
alter table public.shadow_candidate_settlement_runs_v1
  add constraint shadow_candidate_settlement_run_status_allowed
  check (status in ('running', 'success', 'partial', 'failed')) not valid;

alter table public.shadow_candidate_settlement_runs_v1
  drop constraint if exists shadow_candidate_settlement_run_counts_nonnegative;
alter table public.shadow_candidate_settlement_runs_v1
  add constraint shadow_candidate_settlement_run_counts_nonnegative
  check (
    candidates_seen >= 0 and settled_count >= 0 and pending_count >= 0 and
    excluded_count >= 0 and closing_count >= 0 and provider_warning_count >= 0 and
    paper_only = true
  ) not valid;

create index if not exists idx_shadow_candidate_settlement_runs_created
  on public.shadow_candidate_settlement_runs_v1(created_at desc);

create or replace function public.set_shadow_candidate_observation_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_probability numeric;
begin
  new.market := coalesce(nullif(lower(trim(new.market)), ''), 'h2h');
  new.model_version := coalesce(nullif(trim(new.model_version), ''), 'Autonomous-Scorecaster-V13');

  if new.entry_market_probability is null and new.odds > 1 then
    new.entry_market_probability := 1 / new.odds;
  end if;

  if new.model_probability is null and new.odds > 1 and new.edge is not null then
    v_probability := 1 / new.odds + new.edge;
    if v_probability > 0 and v_probability < 1 then
      new.model_probability := v_probability;
    end if;
  end if;

  if new.commence_time is null and new.event_id is not null then
    select min(snapshot.commence_time)
      into new.commence_time
    from public.market_provider_snapshots_v2 snapshot
    where snapshot.event_id = new.event_id;
  end if;

  new.learning_mode := 'shadow-only';
  new.shadow_only := true;
  new.production_probability_changed := false;
  new.automatic_promotion_allowed := false;
  new.real_money_execution := false;
  return new;
end;
$$;

drop trigger if exists autonomous_audit_shadow_defaults on public.autonomous_agent_decision_audit;
create trigger autonomous_audit_shadow_defaults
before insert or update of odds, edge, event_id, market, model_probability, entry_market_probability,
  learning_mode, shadow_only, production_probability_changed, automatic_promotion_allowed, real_money_execution
on public.autonomous_agent_decision_audit
for each row execute function public.set_shadow_candidate_observation_defaults();

create or replace function public.wake_shadow_learning_from_candidate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.settlement_status = 'settled'
     and new.outcome_value in (0, 1)
     and new.model_probability > 0
     and new.model_probability < 1
     and (tg_op = 'INSERT' or old.settlement_status is distinct from new.settlement_status or old.outcome_value is distinct from new.outcome_value) then
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

drop trigger if exists autonomous_audit_wake_shadow_learning on public.autonomous_agent_decision_audit;
create trigger autonomous_audit_wake_shadow_learning
after insert or update of settlement_status, outcome_value, model_probability
on public.autonomous_agent_decision_audit
for each row execute function public.wake_shadow_learning_from_candidate();

alter table public.shadow_candidate_settlement_runs_v1 enable row level security;
alter table public.shadow_candidate_settlement_runs_v1 force row level security;
revoke all on public.shadow_candidate_settlement_runs_v1 from anon, authenticated;
grant all on public.shadow_candidate_settlement_runs_v1 to service_role;

revoke all on function public.set_shadow_candidate_observation_defaults() from public;
revoke all on function public.wake_shadow_learning_from_candidate() from public;
grant execute on function public.set_shadow_candidate_observation_defaults() to service_role;
grant execute on function public.wake_shadow_learning_from_candidate() to service_role;
