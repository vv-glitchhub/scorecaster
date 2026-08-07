-- Scorecaster Two-User Isolation Transactional Probe V1
--
-- RUN ONLY in Supabase SQL Editor against two dedicated disposable test users.
-- Replace both placeholders before execution:
--   __USER_A_UUID__ = attacking/authenticated test user
--   __USER_B_UUID__ = other dedicated test user whose rows must remain invisible
--
-- The script always ends with ROLLBACK. Expected security failures are caught
-- inside PL/pgSQL subtransactions. No test paper row should survive the script.
-- Do not paste passwords, bearer tokens, cookies or service-role values here.

begin;

-- Refuse to run while placeholders remain or if the two identities are equal.
do $$
declare
  user_a uuid;
  user_b uuid;
begin
  if '__USER_A_UUID__' like '__USER_%' or '__USER_B_UUID__' like '__USER_%' then
    raise exception 'Replace __USER_A_UUID__ and __USER_B_UUID__ with dedicated test-account UUIDs before running';
  end if;

  user_a := '__USER_A_UUID__'::uuid;
  user_b := '__USER_B_UUID__'::uuid;
  if user_a = user_b then raise exception 'Two-user isolation requires distinct test users'; end if;
  if not exists (select 1 from auth.users where id = user_a) then raise exception 'Test user A does not exist'; end if;
  if not exists (select 1 from auth.users where id = user_b) then raise exception 'Test user B does not exist'; end if;
end;
$$;

-- Verify both dedicated users have at least one fixture in every reviewed table
-- before switching into the authenticated user-A role. Missing fixtures are an
-- evidence blocker, not a pass.
do $$
declare
  target record;
  rows_a bigint;
  rows_b bigint;
  user_a uuid := '__USER_A_UUID__'::uuid;
  user_b uuid := '__USER_B_UUID__'::uuid;
begin
  for target in
    select * from (values
      ('profiles', 'id'),
      ('bankroll_settings', 'user_id'),
      ('bets', 'user_id'),
      ('watchlist_items', 'user_id'),
      ('alert_inbox', 'user_id'),
      ('autonomous_agent_settings', 'user_id'),
      ('autonomous_agent_state', 'user_id'),
      ('autonomous_agent_runs', 'user_id'),
      ('autonomous_agent_decision_audit', 'user_id'),
      ('shadow_learning_samples', 'user_id'),
      ('shadow_learning_state', 'user_id'),
      ('shadow_learning_cycles', 'user_id')
    ) as matrix(table_name, owner_column)
  loop
    if to_regclass(format('public.%I', target.table_name)) is null then
      raise exception 'Required isolation table public.% is missing', target.table_name;
    end if;
    execute format('select count(*) from public.%I where %I = $1', target.table_name, target.owner_column) into rows_a using user_a;
    execute format('select count(*) from public.%I where %I = $1', target.table_name, target.owner_column) into rows_b using user_b;
    if rows_a = 0 or rows_b = 0 then
      raise exception 'Dedicated fixtures missing for public.% (A %, B %)', target.table_name, rows_a, rows_b;
    end if;
  end loop;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '__USER_A_UUID__', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- As user A, user B must be invisible. UPDATE uses owner=owner and therefore
-- changes no value even if a policy were broken. DELETE is real SQL but the
-- outer transaction is rollback-only; any unexpected affected row raises and
-- aborts the transaction before it can be committed.
do $$
declare
  target record;
  visible_rows bigint;
  affected bigint;
  user_b uuid := '__USER_B_UUID__'::uuid;
begin
  for target in
    select * from (values
      ('profiles', 'id'),
      ('bankroll_settings', 'user_id'),
      ('bets', 'user_id'),
      ('watchlist_items', 'user_id'),
      ('alert_inbox', 'user_id'),
      ('autonomous_agent_settings', 'user_id'),
      ('autonomous_agent_state', 'user_id'),
      ('autonomous_agent_runs', 'user_id'),
      ('autonomous_agent_decision_audit', 'user_id'),
      ('shadow_learning_samples', 'user_id'),
      ('shadow_learning_state', 'user_id'),
      ('shadow_learning_cycles', 'user_id')
    ) as matrix(table_name, owner_column)
  loop
    execute format('select count(*) from public.%I where %I = $1', target.table_name, target.owner_column) into visible_rows using user_b;
    if visible_rows <> 0 then
      raise exception 'RLS isolation failed: user A can SELECT % user-B row(s) from public.%', visible_rows, target.table_name;
    end if;

    affected := 0;
    begin
      execute format('update public.%I set %I = %I where %I = $1', target.table_name, target.owner_column, target.owner_column, target.owner_column) using user_b;
      get diagnostics affected = row_count;
    exception when insufficient_privilege then
      affected := 0;
    end;
    if affected <> 0 then
      raise exception 'RLS isolation failed: user A UPDATE reached % user-B row(s) in public.%', affected, target.table_name;
    end if;

    affected := 0;
    begin
      execute format('delete from public.%I where %I = $1', target.table_name, target.owner_column) using user_b;
      get diagnostics affected = row_count;
    exception when insufficient_privilege then
      affected := 0;
    end;
    if affected <> 0 then
      raise exception 'RLS isolation failed: user A DELETE reached % user-B row(s) in public.%', affected, target.table_name;
    end if;
  end loop;
end;
$$;

-- Database hard-cap execution evidence. Every expected rejection is executed in
-- a PL/pgSQL exception block, which rolls back the setup statements in that
-- block before the handler runs. All generated paper rows are also protected by
-- the outer ROLLBACK.
do $$
declare
  user_a uuid := '__USER_A_UUID__'::uuid;
  bankroll numeric;
  unexpected bigint;
  marker text := 'rls-hardcap-' || replace(gen_random_uuid()::text, '-', '');
  event_id text;
  league_name text;
begin
  select b.bankroll into bankroll
  from public.bankroll_settings b
  where b.user_id = user_a;

  if bankroll is null or bankroll <= 0 then
    raise exception 'Dedicated user A requires a positive bankroll for hard-cap execution evidence';
  end if;

  -- >1% autonomous stake must fail at the database boundary.
  begin
    event_id := marker || '-stake';
    insert into public.bets (
      user_id, match_id, sport, league, home_team, away_team, market, selection,
      bookmaker, odds, stake, commence_time, status, raw_pick, edge, confidence, decision
    ) values (
      user_a, event_id, 'isolation', 'stake-cap', 'A', 'B', 'h2h', 'A',
      'isolation-test', 2.0, bankroll * 0.0101, now() + interval '1 day', 'open',
      jsonb_build_object('autonomous', true, 'eventId', event_id), 0.10, 0.90, 'WATCH'
    );
    raise exception 'Expected >1%% autonomous stake rejection did not occur';
  exception
    when check_violation then
      if position('1% bankroll' in sqlerrm) = 0 then raise; end if;
  end;

  -- Same autonomous event twice in the UTC day must fail.
  begin
    event_id := marker || '-duplicate';
    insert into public.bets (
      user_id, match_id, sport, league, home_team, away_team, market, selection,
      bookmaker, odds, stake, commence_time, status, raw_pick, edge, confidence, decision
    ) values (
      user_a, event_id, 'isolation', 'duplicate-cap', 'A', 'B', 'h2h', 'A',
      'isolation-test', 2.0, bankroll * 0.005, now() + interval '1 day', 'open',
      jsonb_build_object('autonomous', true, 'eventId', event_id), 0.10, 0.90, 'WATCH'
    );
    insert into public.bets (
      user_id, match_id, sport, league, home_team, away_team, market, selection,
      bookmaker, odds, stake, commence_time, status, raw_pick, edge, confidence, decision
    ) values (
      user_a, event_id, 'isolation', 'duplicate-cap', 'A', 'B', 'h2h', 'A',
      'isolation-test', 2.0, bankroll * 0.005, now() + interval '1 day', 'open',
      jsonb_build_object('autonomous', true, 'eventId', event_id), 0.10, 0.90, 'WATCH'
    );
    raise exception 'Expected same-event duplicate rejection did not occur';
  exception
    when check_violation then
      if position('already used this event' in sqlerrm) = 0 then raise; end if;
  end;

  -- Existing paper exposure may be non-autonomous. 4.5% existing + 0.75%
  -- autonomous attempt must trip the 5% daily database cap while the attempt is
  -- individually below 1% and in a different league from the baseline row.
  begin
    insert into public.bets (
      user_id, match_id, sport, league, home_team, away_team, market, selection,
      bookmaker, odds, stake, commence_time, status, raw_pick, edge, confidence, decision
    ) values (
      user_a, marker || '-daily-baseline', 'isolation', 'daily-baseline', 'A', 'B', 'h2h', 'A',
      'isolation-test', 2.0, bankroll * 0.045, now() + interval '1 day', 'open',
      jsonb_build_object('autonomous', false, 'eventId', marker || '-daily-baseline'), 0.10, 0.90, 'WATCH'
    );
    insert into public.bets (
      user_id, match_id, sport, league, home_team, away_team, market, selection,
      bookmaker, odds, stake, commence_time, status, raw_pick, edge, confidence, decision
    ) values (
      user_a, marker || '-daily-attempt', 'isolation', 'daily-attempt', 'A', 'B', 'h2h', 'A',
      'isolation-test', 2.0, bankroll * 0.0075, now() + interval '1 day', 'open',
      jsonb_build_object('autonomous', true, 'eventId', marker || '-daily-attempt'), 0.10, 0.90, 'WATCH'
    );
    raise exception 'Expected >5%% daily paper exposure rejection did not occur';
  exception
    when check_violation then
      if position('5% bankroll' in sqlerrm) = 0 then raise; end if;
  end;

  -- Existing same-league paper exposure 2.25% + 0.5% autonomous attempt must
  -- trip the 2.5% same-league hard cap while total daily exposure stays <5%.
  begin
    league_name := marker || '-league';
    insert into public.bets (
      user_id, match_id, sport, league, home_team, away_team, market, selection,
      bookmaker, odds, stake, commence_time, status, raw_pick, edge, confidence, decision
    ) values (
      user_a, marker || '-league-baseline', 'isolation', league_name, 'A', 'B', 'h2h', 'A',
      'isolation-test', 2.0, bankroll * 0.0225, now() + interval '1 day', 'open',
      jsonb_build_object('autonomous', false, 'eventId', marker || '-league-baseline'), 0.10, 0.90, 'WATCH'
    );
    insert into public.bets (
      user_id, match_id, sport, league, home_team, away_team, market, selection,
      bookmaker, odds, stake, commence_time, status, raw_pick, edge, confidence, decision
    ) values (
      user_a, marker || '-league-attempt', 'isolation', league_name, 'A', 'B', 'h2h', 'A',
      'isolation-test', 2.0, bankroll * 0.005, now() + interval '1 day', 'open',
      jsonb_build_object('autonomous', true, 'eventId', marker || '-league-attempt'), 0.10, 0.90, 'WATCH'
    );
    raise exception 'Expected >2.5%% same-league exposure rejection did not occur';
  exception
    when check_violation then
      if position('2.5% bankroll' in sqlerrm) = 0 then raise; end if;
  end;

  select count(*) into unexpected
  from public.bets
  where user_id = user_a and match_id like marker || '%';
  if unexpected <> 0 then
    raise exception 'Hard-cap probe left % temporary paper row(s) inside the transaction', unexpected;
  end if;
end;
$$;

-- Machine-readable success marker. This result is evidence only if the SQL
-- editor run itself is retained; the surrounding transaction is still rolled
-- back immediately after this SELECT.
select json_build_object(
  'ok', true,
  'version', 'scorecaster-two-user-isolation-transactional-v1',
  'crossUserSelect', 'passed',
  'crossUserNoopUpdate', 'passed',
  'crossUserDeleteRollbackProbe', 'passed',
  'maxAutonomousStake1Percent', 'passed',
  'maxDailyPaperExposure5Percent', 'passed',
  'maxSameLeagueExposure2_5Percent', 'passed',
  'sameEventDuplicate', 'passed',
  'persistentRowsWritten', false,
  'transactionOutcome', 'rollback',
  'paperOnly', true,
  'realMoneyExecution', false,
  'verifiedAt', now()
) as scorecaster_two_user_isolation_transactional_evidence;

rollback;
