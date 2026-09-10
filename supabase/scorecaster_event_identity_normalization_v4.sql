-- Scorecaster Event Identity Normalization V4
-- Add the remaining observed Ligue 1 organizational suffix (SCO).
-- Matching remains deterministic and still requires both teams plus the
-- existing bounded kickoff window in refresh_event_identity_map().

create or replace function scorecaster_private.normalize_team_identity(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  with base as (
    select trim(both '-' from regexp_replace(
      regexp_replace(
        extensions.unaccent(lower(coalesce(value,''))),
        '\m(fc|afc|cf|sc|ac|fk|bk|if|aif|ud|cd|rc|rcd|ssc|club|football|calcio|futbol|fútbol|tsg|sv|ss|cfc|acf|ogc|osc|sco|aj|es|fsv|deportivo|olympique|stade|de)\M',
        '',
        'g'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )) as identity_key
  ),
  numbered as (
    select trim(both '-' from regexp_replace(
      identity_key,
      '(^|-)(1|04|05|07|29|1899|1901|1907|1913)(-|$)',
      '-',
      'g'
    )) as identity_key
    from base
  )
  select case identity_key
    when 'bayern-munich' then 'bayern-munchen'
    when 'athletic-bilbao' then 'athletic'
    when 'rennais' then 'rennes'
    when 'lyonnais' then 'lyon'
    when 'brestois' then 'brest'
    when 'strasbourg-alsace' then 'strasbourg'
    when 'espanyol-barcelona' then 'espanyol'
    when 'real-betis-balompie' then 'real-betis'
    when 'rayo-vallecano-madrid' then 'rayo-vallecano'
    else identity_key
  end
  from numbered;
$$;

revoke all on function scorecaster_private.normalize_team_identity(text) from public, anon, authenticated;
grant execute on function scorecaster_private.normalize_team_identity(text) to service_role;

do $$
begin
  if scorecaster_private.normalize_team_identity('Angers')
     is distinct from scorecaster_private.normalize_team_identity('Angers SCO') then
    raise exception 'event identity normalization regression: Angers <> Angers SCO';
  end if;
end;
$$;

select scorecaster_private.refresh_event_identity_map();