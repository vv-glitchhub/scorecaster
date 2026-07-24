-- Scorecaster Shadow Learning Store V1
-- Run after scorecaster_autonomous_agent.sql.
-- Captures immutable Autonomous Scorecaster V12 paper-decision snapshots and appends settlement outcomes.
-- No automatic model promotion or real-money execution capability exists in this migration.

create extension if not exists pgcrypto;

create table if not exists public.shadow_learning_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bet_id uuid not null references public.bets(id) on delete cascade,
  event_id text,
  match text,
  selection text,
  sport text,
  league text,
  market text,
  agent_version text,
  model_version text,
  original_probability numeric,
  selected_probability numeric,
  market_probability numeric,
  edge numeric,
  ev numeric,
  odds_at_selection numeric,
  stake numeric not null default 0,
  initial_decision text not null default 'PLAY',
  final_decision text not null default 'PLAY',
  decision_reasons jsonb not null default '[]'::jsonb,
  data_sources_used jsonb not null default '[]'::jsonb,
  data_sources_unused jsonb not null default '[]'::jsonb,
  context_signals jsonb not null default '{}'::jsonb,
  provider_quality jsonb not null default '{}'::jsonb,
  provider_conflicts jsonb not null default '{}'::jsonb,
  risk_governor jsonb not null default '{}'::jsonb,
  decision_snapshot jsonb not null default '{}'::jsonb,
  settlement_status text not null default 'open',
  result text,
  closing_odds numeric,
  clv numeric,
  profit numeric,
  settled_at timestamptz,
  learning_mode text not null default 'shadow-only',
  shadow_only boolean not null default true,
  production_probability_changed boolean not null default false,
  automatic_promotion_allowed boolean not null default false,
  real_money_execution boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bet_id)
);

create table if not exists public.shadow_learning_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_check_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text not null default 'idle',
  last_cycle_id uuid,
  last_sample_size integer not null default 0,
  last_clv_sample integer not null default 0,
  review_ready boolean not null default false,
  last_error text,
  last_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shadow_learning_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'collecting-evidence',
  sample_size integer not null default 0,
  clv_sample integer not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  calibration jsonb not null default '{}'::jsonb,
  segments jsonb not null default '{}'::jsonb,
  gates jsonb not null default '{}'::jsonb,
  promotion jsonb not null default '{}'::jsonb,
  safety jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.shadow_learning_state
  drop constraint if exists shadow_learning_state_status_allowed;
alter table public.shadow_learning_state
  add constraint shadow_learning_state_status_allowed
  check (last_status in ('idle', 'running', 'collecting-evidence', 'challenger-review-ready', 'challenger-rejected', 'frozen-drift', 'error')) not valid;

alter table public.shadow_learning_cycles
  drop constraint if exists shadow_learning_cycle_status_allowed;
alter table public.shadow_learning_cycles
  add constraint shadow_learning_cycle_status_allowed
  check (status in ('collecting-evidence', 'challenger-review-ready', 'challenger-rejected', 'frozen-drift', 'error')) not valid;

alter table public.shadow_learning_samples
  drop constraint if exists shadow_learning_sample_safety_boundary;
alter table public.shadow_learning_samples
  add constraint shadow_learning_sample_safety_boundary
  check (
    learning_mode = 'shadow-only' and
    shadow_only = true and
    production_probability_changed = false and
    automatic_promotion_allowed = false and
    real_money_execution = false
  ) not valid;

alter table public.shadow_learning_samples
  drop constraint if exists shadow_learning_sample_probability_range;
alter table public.shadow_learning_samples
  add constraint shadow_learning_sample_probability_range
  check (
    (original_probability is null or original_probability between 0 and 1) and
    (selected_probability is null or selected_probability between 0 and 1) and
    (market_probability is null or market_probability between 0 and 1)
  ) not valid;

alter table public.shadow_learning_samples
  drop constraint if exists shadow_learning_sample_settlement_allowed;
alter table public.shadow_learning_samples
  add constraint shadow_learning_sample_settlement_allowed
  check (
    settlement_status in ('open', 'settled', 'void') and
    (result is null or result in ('win', 'loss', 'push', 'void'))
  ) not valid;

create index if not exists idx_shadow_learning_samples_user_settled
  on public.shadow_learning_samples(user_id, settlement_status, settled_at desc);
create index if not exists idx_shadow_learning_samples_user_created
  on public.shadow_learning_samples(user_id, created_at desc);
create index if not exists idx_shadow_learning_samples_event
  on public.shadow_learning_samples(event_id, created_at desc);
create index if not exists idx_shadow_learning_state_due
  on public.shadow_learning_state(next_check_at, lease_expires_at);
create index if not exists idx_shadow_learning_cycles_user_created
  on public.shadow_learning_cycles(user_id, created_at desc);

create or replace function public.shadow_json_numeric(p_value jsonb)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_value is null or jsonb_typeof(p_value) not in ('number', 'string') then
    return null;
  end if;
  return nullif(trim(both '"' from p_value::text), '')::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.set_shadow_learning_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shadow_learning_samples_set_updated_at on public.shadow_learning_samples;
create trigger shadow_learning_samples_set_updated_at
before update on public.shadow_learning_samples
for each row execute function public.set_shadow_learning_updated_at();

drop trigger if exists shadow_learning_state_set_updated_at on public.shadow_learning_state;
create trigger shadow_learning_state_set_updated_at
before update on public.shadow_learning_state
for each row execute function public.set_shadow_learning_updated_at();

create or replace function public.sync_shadow_learning_sample(p_bet_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bet public.bets%rowtype;
  v_raw jsonb;
  v_ticket jsonb;
  v_original_probability numeric;
  v_selected_probability numeric;
  v_market_probability numeric;
  v_clv numeric;
  v_result text;
  v_settlement_status text;
begin
  select * into v_bet from public.bets where id = p_bet_id;
  if not found then return; end if;

  v_raw := coalesce(v_bet.raw_pick, '{}'::jsonb);
  if coalesce(v_raw->>'paperOnly', 'false') <> 'true' then return; end if;
  if coalesce(v_raw->>'realMoneyBetting', 'false') = 'true' then
    raise exception 'Real-money rows cannot enter Shadow Learning';
  end if;

  v_ticket := coalesce(v_raw->'decisionTicket', '{}'::jsonb);
  v_original_probability := public.shadow_json_numeric(v_raw->'originalProbability');
  v_selected_probability := coalesce(
    public.shadow_json_numeric(v_raw->'modelProbability'),
    v_original_probability
  );
  v_market_probability := coalesce(
    public.shadow_json_numeric(v_raw->'impliedProbability'),
    case when v_bet.odds > 1 then 1 / v_bet.odds else null end
  );
  v_clv := coalesce(
    v_bet.clv,
    case when v_bet.odds > 1 and v_bet.closing_odds > 1 then v_bet.odds / v_bet.closing_odds - 1 else null end
  );
  v_result := case
    when v_bet.status = 'won' then 'win'
    when v_bet.status = 'lost' then 'loss'
    when v_bet.status = 'push' then 'push'
    when v_bet.status = 'void' then 'void'
    when lower(coalesce(v_bet.result, '')) in ('win', 'won') then 'win'
    when lower(coalesce(v_bet.result, '')) in ('loss', 'lost') then 'loss'
    when lower(coalesce(v_bet.result, '')) in ('push', 'void') then lower(v_bet.result)
    else null
  end;
  v_settlement_status := case
    when v_bet.status = 'void' or v_result = 'void' then 'void'
    when v_result in ('win', 'loss', 'push') then 'settled'
    else 'open'
  end;

  insert into public.shadow_learning_samples (
    user_id, bet_id, event_id, match, selection, sport, league, market,
    agent_version, model_version, original_probability, selected_probability, market_probability,
    edge, ev, odds_at_selection, stake, initial_decision, final_decision,
    decision_reasons, data_sources_used, data_sources_unused, context_signals,
    provider_quality, provider_conflicts, risk_governor, decision_snapshot,
    settlement_status, result, closing_odds, clv, profit, settled_at,
    learning_mode, shadow_only, production_probability_changed,
    automatic_promotion_allowed, real_money_execution, created_at
  ) values (
    v_bet.user_id, v_bet.id, nullif(v_raw->>'eventId', ''), v_bet.match, v_bet.label,
    v_bet.sport, v_bet.league, v_bet.market,
    nullif(v_raw->>'agentVersion', ''), nullif(v_raw->>'portfolioAgentVersion', ''),
    v_original_probability, v_selected_probability, v_market_probability,
    v_bet.edge, v_bet.ev, v_bet.odds, greatest(0, coalesce(v_bet.stake, 0)),
    coalesce(nullif(v_raw->>'decision', ''), 'PLAY'),
    coalesce(nullif(v_raw->>'decision', ''), 'PLAY'),
    coalesce(v_raw->'decisionReasons', '[]'::jsonb),
    coalesce(v_ticket->'usedDataSources', '[]'::jsonb),
    coalesce(v_ticket->'unusedOrMissingData', '[]'::jsonb),
    jsonb_build_object(
      'signals', coalesce(v_ticket->'contextSignals', '{}'::jsonb),
      'evidence', coalesce(v_ticket->'evidence', '[]'::jsonb),
      'unifiedSportsData', coalesce(v_ticket->'unifiedSportsData', '{}'::jsonb)
    ),
    jsonb_build_object(
      'dataQuality', v_ticket->'dataQuality',
      'providerSource', v_raw->'providerSource',
      'fixtureSource', v_raw->'fixtureSource',
      'priceGuard', v_ticket->'priceGuard'
    ),
    jsonb_build_object(
      'counterArguments', coalesce(v_ticket->'counterArguments', '[]'::jsonb),
      'blockers', coalesce(v_ticket->'blockers', '[]'::jsonb)
    ),
    coalesce(v_raw->'riskGovernor', '{}'::jsonb),
    v_raw,
    v_settlement_status, v_result, v_bet.closing_odds, v_clv, v_bet.profit,
    case when v_settlement_status <> 'open' then coalesce(v_bet.updated_at, now()) else null end,
    'shadow-only', true, false, false, false,
    coalesce(v_bet.created_at, now())
  )
  on conflict (user_id, bet_id) do update set
    settlement_status = excluded.settlement_status,
    result = excluded.result,
    closing_odds = excluded.closing_odds,
    clv = excluded.clv,
    profit = excluded.profit,
    settled_at = excluded.settled_at,
    updated_at = now();

  insert into public.shadow_learning_state (user_id, next_check_at, last_status)
  values (v_bet.user_id, now(), 'idle')
  on conflict (user_id) do update
    set next_check_at = least(public.shadow_learning_state.next_check_at, now()),
        last_status = case when public.shadow_learning_state.last_status = 'running' then 'running' else 'idle' end,
        last_error = null;
end;
$$;

create or replace function public.capture_shadow_learning_from_bet()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sync_shadow_learning_sample(new.id);
  return new;
end;
$$;

drop trigger if exists bets_capture_shadow_learning on public.bets;
create trigger bets_capture_shadow_learning
after insert or update of status, result, profit, closing_odds, clv, raw_pick
on public.bets
for each row execute function public.capture_shadow_learning_from_bet();

create or replace function public.claim_shadow_learning_users(p_limit integer default 10)
returns table(user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with claimed as (
    select state.user_id
    from public.shadow_learning_state state
    where state.next_check_at <= now()
      and (state.lease_expires_at is null or state.lease_expires_at < now())
    order by state.next_check_at asc, state.updated_at asc
    for update of state skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 10))
  )
  update public.shadow_learning_state state
  set lease_expires_at = now() + interval '10 minutes',
      last_started_at = now(),
      last_status = 'running',
      last_error = null,
      next_check_at = now() + interval '24 hours'
  from claimed
  where state.user_id = claimed.user_id
  returning state.user_id;
end;
$$;

create or replace function public.complete_shadow_learning_user(
  p_user_id uuid,
  p_status text,
  p_cycle_id uuid default null,
  p_sample_size integer default 0,
  p_clv_sample integer default 0,
  p_review_ready boolean default false,
  p_error text default null,
  p_summary jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('collecting-evidence', 'challenger-review-ready', 'challenger-rejected', 'frozen-drift', 'error') then
    raise exception 'Unsupported Shadow Learning status';
  end if;
  update public.shadow_learning_state
  set lease_expires_at = null,
      last_completed_at = now(),
      last_status = p_status,
      last_cycle_id = p_cycle_id,
      last_sample_size = greatest(0, coalesce(p_sample_size, 0)),
      last_clv_sample = greatest(0, coalesce(p_clv_sample, 0)),
      review_ready = coalesce(p_review_ready, false),
      last_error = nullif(left(coalesce(p_error, ''), 500), ''),
      last_summary = coalesce(p_summary, '{}'::jsonb),
      next_check_at = case when p_status = 'error' then now() + interval '1 hour' else now() + interval '24 hours' end
  where user_id = p_user_id;
end;
$$;

-- Backfill existing V12 governed paper rows. Incomplete probability rows remain visible but are excluded by the evaluator.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.bets
    where coalesce(raw_pick->>'paperOnly', 'false') = 'true'
      and coalesce(raw_pick->>'realMoneyBetting', 'false') <> 'true'
  loop
    perform public.sync_shadow_learning_sample(v_id);
  end loop;
end;
$$;

alter table public.shadow_learning_samples enable row level security;
alter table public.shadow_learning_samples force row level security;
alter table public.shadow_learning_state enable row level security;
alter table public.shadow_learning_state force row level security;
alter table public.shadow_learning_cycles enable row level security;
alter table public.shadow_learning_cycles force row level security;

drop policy if exists "Users read own Shadow Learning samples" on public.shadow_learning_samples;
create policy "Users read own Shadow Learning samples"
on public.shadow_learning_samples for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own Shadow Learning state" on public.shadow_learning_state;
create policy "Users read own Shadow Learning state"
on public.shadow_learning_state for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own Shadow Learning cycles" on public.shadow_learning_cycles;
create policy "Users read own Shadow Learning cycles"
on public.shadow_learning_cycles for select to authenticated
using (auth.uid() = user_id);

revoke all on public.shadow_learning_samples from anon, authenticated;
revoke all on public.shadow_learning_state from anon, authenticated;
revoke all on public.shadow_learning_cycles from anon, authenticated;
revoke all on function public.shadow_json_numeric(jsonb) from public, anon, authenticated;
revoke all on function public.sync_shadow_learning_sample(uuid) from public, anon, authenticated;
revoke all on function public.capture_shadow_learning_from_bet() from public, anon, authenticated;
revoke all on function public.claim_shadow_learning_users(integer) from public, anon, authenticated;
revoke all on function public.complete_shadow_learning_user(uuid, text, uuid, integer, integer, boolean, text, jsonb) from public, anon, authenticated;

grant select on public.shadow_learning_samples to authenticated;
grant select on public.shadow_learning_state to authenticated;
grant select on public.shadow_learning_cycles to authenticated;

grant select, insert, update, delete on public.shadow_learning_samples to service_role;
grant select, insert, update, delete on public.shadow_learning_state to service_role;
grant select, insert, update, delete on public.shadow_learning_cycles to service_role;
grant execute on function public.shadow_json_numeric(jsonb) to service_role;
grant execute on function public.sync_shadow_learning_sample(uuid) to service_role;
grant execute on function public.claim_shadow_learning_users(integer) to service_role;
grant execute on function public.complete_shadow_learning_user(uuid, text, uuid, integer, integer, boolean, text, jsonb) to service_role;

-- Hard boundary: no bookmaker credentials, payments, deposits, withdrawals or real-money execution exist here.
