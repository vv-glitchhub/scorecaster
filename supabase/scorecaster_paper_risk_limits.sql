-- Scorecaster paper-risk enforcement
-- Run after scorecaster_schema.sql and scorecaster_auth_cloud.sql.
-- Safe to run more than once.

create or replace function public.enforce_paper_stake_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bankroll numeric := 1000;
  v_max_stake_percent numeric := 2;
  v_max_open_exposure_percent numeric := 8;
  v_max_league_exposure_percent numeric := 4;
  v_min_edge numeric := 0.025;
  v_min_confidence numeric := 0.58;
  v_max_stake numeric;
  v_max_open_exposure numeric;
  v_max_league_exposure numeric;
  v_existing_open_exposure numeric := 0;
  v_existing_league_exposure numeric := 0;
  v_source text := '';
begin
  -- Serialize paper-risk checks for one user even when the bankroll settings row
  -- has not been created yet. The lock is released automatically at transaction end.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select bankroll,
         max_stake_percent,
         max_daily_exposure_percent,
         max_single_league_exposure_percent,
         min_edge,
         min_confidence
  into v_bankroll,
       v_max_stake_percent,
       v_max_open_exposure_percent,
       v_max_league_exposure_percent,
       v_min_edge,
       v_min_confidence
  from public.bankroll_settings
  where user_id = new.user_id
  for update;

  v_bankroll := coalesce(v_bankroll, 1000);
  v_max_stake_percent := coalesce(v_max_stake_percent, 2);
  v_max_open_exposure_percent := coalesce(v_max_open_exposure_percent, 8);
  v_max_league_exposure_percent := coalesce(v_max_league_exposure_percent, 4);
  v_min_edge := coalesce(v_min_edge, 0.025);
  v_min_confidence := coalesce(v_min_confidence, 0.58);
  v_max_stake := greatest(0, v_bankroll * v_max_stake_percent / 100);
  v_max_open_exposure := greatest(0, v_bankroll * v_max_open_exposure_percent / 100);
  v_max_league_exposure := greatest(0, v_bankroll * v_max_league_exposure_percent / 100);
  v_source := lower(coalesce(new.raw_pick ->> 'source', ''));

  -- Limits guard new or still-open paper exposure. They must not prevent an old
  -- open row from being settled after the user has tightened their settings.
  if new.status = 'open' and new.stake > v_max_stake then
    raise exception 'Paper stake exceeds the configured virtual-bankroll limit'
      using errcode = '23514';
  end if;

  -- User quality thresholds govern Scorecaster-generated open picks. Manual
  -- paper entries remain available for comparison and education.
  if new.status = 'open' and v_source like 'scorecaster%' then
    if new.edge is null or new.edge < v_min_edge then
      raise exception 'Scorecaster pick is below the configured minimum edge'
        using errcode = '23514';
    end if;

    if new.confidence is null or new.confidence < v_min_confidence then
      raise exception 'Scorecaster pick is below the configured minimum confidence'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'open' then
    select coalesce(sum(stake), 0)
    into v_existing_open_exposure
    from public.bets
    where user_id = new.user_id
      and status = 'open'
      and id <> new.id;

    if v_existing_open_exposure + new.stake > v_max_open_exposure then
      raise exception 'Open paper exposure exceeds the configured virtual-bankroll limit'
        using errcode = '23514';
    end if;

    select coalesce(sum(stake), 0)
    into v_existing_league_exposure
    from public.bets
    where user_id = new.user_id
      and status = 'open'
      and coalesce(league, 'manual') = coalesce(new.league, 'manual')
      and id <> new.id;

    if v_existing_league_exposure + new.stake > v_max_league_exposure then
      raise exception 'Open paper league exposure exceeds the configured virtual-bankroll limit'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_paper_stake_limit() from public;
revoke all on function public.enforce_paper_stake_limit() from anon;
revoke all on function public.enforce_paper_stake_limit() from authenticated;

drop trigger if exists bets_enforce_paper_stake_limit on public.bets;
create trigger bets_enforce_paper_stake_limit
before insert or update of stake, user_id, status, league, edge, confidence, raw_pick on public.bets
for each row execute function public.enforce_paper_stake_limit();
