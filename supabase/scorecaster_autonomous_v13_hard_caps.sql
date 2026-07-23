-- Scorecaster Autonomous V13 database hard caps
-- Run after scorecaster_autonomous_agent_v2.sql.
-- This trigger is the final authority for autonomous paper-only daily exposure.

create or replace function public.enforce_autonomous_v13_hard_caps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := lower(coalesce(new.raw_pick ->> 'source', ''));
  v_event_id text := lower(coalesce(new.raw_pick ->> 'eventId', new.raw_pick ->> 'event_id', new.match, ''));
  v_bankroll numeric := 1000;
  v_daily_pick_limit integer := 3;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_max_stake numeric;
  v_max_daily numeric;
  v_max_league numeric;
  v_daily_count integer := 0;
  v_daily_stake numeric := 0;
  v_daily_league_stake numeric := 0;
  v_duplicate_count integer := 0;
begin
  if new.status <> 'open' or v_source not like 'scorecaster-autonomous%' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':autonomous-v13', 0));

  select coalesce(bankroll, 1000)
  into v_bankroll
  from public.bankroll_settings
  where user_id = new.user_id
  for update;

  select least(3, greatest(1, coalesce(daily_pick_limit, 3)))
  into v_daily_pick_limit
  from public.autonomous_agent_settings
  where user_id = new.user_id
  for update;

  v_bankroll := greatest(0, coalesce(v_bankroll, 1000));
  v_daily_pick_limit := least(3, greatest(1, coalesce(v_daily_pick_limit, 3)));
  v_max_stake := v_bankroll * 0.01;
  v_max_daily := v_bankroll * 0.05;
  v_max_league := v_bankroll * 0.025;

  if new.stake <= 0 or new.stake > v_max_stake then
    raise exception 'Autonomous V13 stake exceeds the 1 percent system hard cap'
      using errcode = '23514';
  end if;

  select count(*), coalesce(sum(stake), 0)
  into v_daily_count, v_daily_stake
  from public.bets
  where user_id = new.user_id
    and created_at >= v_day_start
    and lower(coalesce(raw_pick ->> 'source', '')) like 'scorecaster-autonomous%'
    and id is distinct from new.id;

  if v_daily_count >= v_daily_pick_limit then
    raise exception 'Autonomous V13 UTC daily pick limit reached'
      using errcode = '23514';
  end if;

  if v_daily_stake + new.stake > v_max_daily then
    raise exception 'Autonomous V13 UTC daily exposure exceeds the 5 percent system hard cap'
      using errcode = '23514';
  end if;

  select coalesce(sum(stake), 0)
  into v_daily_league_stake
  from public.bets
  where user_id = new.user_id
    and created_at >= v_day_start
    and lower(coalesce(raw_pick ->> 'source', '')) like 'scorecaster-autonomous%'
    and coalesce(league, sport, 'unknown') = coalesce(new.league, new.sport, 'unknown')
    and id is distinct from new.id;

  if v_daily_league_stake + new.stake > v_max_league then
    raise exception 'Autonomous V13 UTC league exposure exceeds the 2.5 percent system hard cap'
      using errcode = '23514';
  end if;

  if v_event_id <> '' then
    select count(*)
    into v_duplicate_count
    from public.bets
    where user_id = new.user_id
      and created_at >= v_day_start
      and lower(coalesce(raw_pick ->> 'source', '')) like 'scorecaster-autonomous%'
      and lower(coalesce(raw_pick ->> 'eventId', raw_pick ->> 'event_id', match, '')) = v_event_id
      and id is distinct from new.id;

    if v_duplicate_count > 0 then
      raise exception 'Autonomous V13 already used this event during the UTC day'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_autonomous_v13_hard_caps() from public;
revoke all on function public.enforce_autonomous_v13_hard_caps() from anon;
revoke all on function public.enforce_autonomous_v13_hard_caps() from authenticated;

drop trigger if exists bets_enforce_autonomous_v13_hard_caps on public.bets;
create trigger bets_enforce_autonomous_v13_hard_caps
before insert or update of stake, user_id, status, league, sport, raw_pick on public.bets
for each row execute function public.enforce_autonomous_v13_hard_caps();
