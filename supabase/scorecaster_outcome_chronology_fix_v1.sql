create or replace function scorecaster_private.enforce_openfootball_outcome_chronology()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'final'
     and new.finality_verified = true
     and coalesce(new.source_ids, '[]'::jsonb) ? 'openfootball_cc0'
     and new.observed_at is not null then
    new.resolved_at := new.observed_at;
  end if;
  return new;
end;
$$;

revoke all on function scorecaster_private.enforce_openfootball_outcome_chronology() from public, anon, authenticated;

drop trigger if exists scorecaster_openfootball_outcome_chronology_v1 on public.scorecaster_event_outcomes_v1;
create trigger scorecaster_openfootball_outcome_chronology_v1
before insert or update on public.scorecaster_event_outcomes_v1
for each row execute function scorecaster_private.enforce_openfootball_outcome_chronology();

update public.scorecaster_event_outcomes_v1
set resolved_at = observed_at
where status = 'final'
  and finality_verified = true
  and coalesce(source_ids, '[]'::jsonb) ? 'openfootball_cc0'
  and observed_at is not null
  and resolved_at is distinct from observed_at;