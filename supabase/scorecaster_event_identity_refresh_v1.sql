create or replace function scorecaster_private.normalize_team_identity(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(lower(coalesce(value,'')), '\\m(fc|afc|cf|sc|ac|fk|bk|if|aif|club|football|calcio)\\M', '', 'g'),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create or replace function scorecaster_private.refresh_event_identity_map()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.scorecaster_event_identity_map_v1 (
    canonical_event_id, source_id, source_event_id, sport_key, league,
    home_team, away_team, commence_time, mapping_method, match_confidence,
    verified, lineage, paper_only, updated_at
  )
  select distinct on (f.event_id)
    o.event_id,
    'scorecaster_feature_snapshot',
    f.event_id,
    f.sport_key,
    coalesce(f.league, o.league),
    f.home_team,
    f.away_team,
    f.commence_time,
    'normalized-teams-kickoff-window',
    case
      when abs(extract(epoch from (f.commence_time - o.commence_time))) <= 3 * 3600 then 0.98
      else 0.94
    end,
    true,
    jsonb_build_object(
      'featureSnapshotId', f.id,
      'canonicalOutcomeId', o.id,
      'canonicalOutcomeHash', o.outcome_hash,
      'sourceIds', o.source_ids
    ),
    true,
    now()
  from public.scorecaster_pit_feature_snapshots_v1 f
  join public.scorecaster_event_outcomes_v1 o
    on o.status = 'final'
   and o.finality_verified = true
   and scorecaster_private.normalize_team_identity(f.home_team) = scorecaster_private.normalize_team_identity(o.home_team)
   and scorecaster_private.normalize_team_identity(f.away_team) = scorecaster_private.normalize_team_identity(o.away_team)
   and f.commence_time is not null
   and o.commence_time is not null
   and abs(extract(epoch from (f.commence_time - o.commence_time))) <= 36 * 3600
  order by f.event_id, abs(extract(epoch from (f.commence_time - o.commence_time))) asc
  on conflict (source_id, source_event_id) do update set
    canonical_event_id = excluded.canonical_event_id,
    sport_key = excluded.sport_key,
    league = excluded.league,
    home_team = excluded.home_team,
    away_team = excluded.away_team,
    commence_time = excluded.commence_time,
    mapping_method = excluded.mapping_method,
    match_confidence = excluded.match_confidence,
    verified = excluded.verified,
    lineage = excluded.lineage,
    paper_only = true,
    updated_at = now();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function scorecaster_private.normalize_team_identity(text) from public, anon, authenticated;
revoke all on function scorecaster_private.refresh_event_identity_map() from public, anon, authenticated;
grant execute on function scorecaster_private.refresh_event_identity_map() to service_role;

select cron.schedule(
  'scorecaster-event-identity-refresh-6h',
  '25 */6 * * *',
  $$select scorecaster_private.refresh_event_identity_map();$$
);