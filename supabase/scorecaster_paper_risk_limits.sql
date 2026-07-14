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
  v_max_stake numeric;
  v_max_open_exposure numeric;
  v_existing_open_exposure numeric := 0;
begin
  select bankroll, max_stake_percent, max_daily_exposure_percent
  into v_bankroll, v_max_stake_percent, v_max_open_exposure_percent
  from public.bankroll_settings
  where user_id = new.user_id;

  v_bankroll := coalesce(v_bankroll, 1000);
  v_max_stake_percent := coalesce(v_max_stake_percent, 2);
  v_max_open_exposure_percent := coalesce(v_max_open_exposure_percent, 8);
  v_max_stake := greatest(0, v_bankroll * v_max_stake_percent / 100);
  v_max_open_exposure := greatest(0, v_bankroll * v_max_open_exposure_percent / 100);

  if new.stake > v_max_stake then
    raise exception 'Paper stake exceeds the configured virtual-bankroll limit'
      using errcode = '23514';
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
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_paper_stake_limit() from public;
revoke all on function public.enforce_paper_stake_limit() from anon;
revoke all on function public.enforce_paper_stake_limit() from authenticated;

drop trigger if exists bets_enforce_paper_stake_limit on public.bets;
create trigger bets_enforce_paper_stake_limit
before insert or update of stake, user_id, status on public.bets
for each row execute function public.enforce_paper_stake_limit();
