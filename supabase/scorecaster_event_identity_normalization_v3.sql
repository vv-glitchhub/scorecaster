-- Scorecaster Event Identity Normalization V3
-- Purpose: reconcile conservative provider/canonical club-name variants in the
-- five owned football leagues without introducing fuzzy matching.
--
-- Safety properties:
-- - deterministic and immutable;
-- - no probabilistic/fuzzy similarity matching;
-- - event mapper still requires both teams and a bounded kickoff window;
-- - no model probabilities, decisions, paper bankrolls or real-money surfaces change.

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
        '\m(fc|afc|cf|sc|ac|fk|bk|if|aif|ud|cd|rc|rcd|ssc|club|football|calcio|futbol|fútbol|tsg|sv|ss|cfc|acf|ogc|osc|aj|es|fsv|deportivo|olympique|stade|de)\M',
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

-- Migration-level deterministic regression proof. Every pair below is a known
-- provider/canonical naming variant observed in the owned football pipeline.
do $$
declare
  pair record;
begin
  for pair in
    select * from (values
      ('Union Berlin','1. FC Union Berlin'),
      ('Augsburg','FC Augsburg'),
      ('Bayer Leverkusen','Bayer 04 Leverkusen'),
      ('SC Paderborn','SC Paderborn 07'),
      ('FSV Mainz 05','1. FSV Mainz 05'),
      ('TSG Hoffenheim','TSG 1899 Hoffenheim'),
      ('Werder Bremen','SV Werder Bremen'),
      ('Bayern Munich','FC Bayern München'),
      ('Elversberg','SV 07 Elversberg'),
      ('Athletic Bilbao','Athletic Club'),
      ('Alavés','Deportivo Alavés'),
      ('Espanyol','RCD Espanyol de Barcelona'),
      ('Celta Vigo','RC Celta de Vigo'),
      ('Real Betis','Real Betis Balompié'),
      ('Rayo Vallecano','Rayo Vallecano de Madrid'),
      ('Rennes','Stade Rennais FC 1901'),
      ('Marseille','Olympique de Marseille'),
      ('Strasbourg','RC Strasbourg Alsace'),
      ('Nice','OGC Nice'),
      ('Lyon','Olympique Lyonnais'),
      ('Lille','Lille OSC'),
      ('Troyes','ES Troyes AC'),
      ('Brest','Stade Brestois 29'),
      ('Fiorentina','ACF Fiorentina'),
      ('Genoa','Genoa CFC'),
      ('Lazio','SS Lazio'),
      ('Como','Como 1907'),
      ('Parma','Parma Calcio 1913')
    ) as aliases(provider_name, canonical_name)
  loop
    if scorecaster_private.normalize_team_identity(pair.provider_name)
       is distinct from scorecaster_private.normalize_team_identity(pair.canonical_name) then
      raise exception 'event identity normalization regression: % <> %', pair.provider_name, pair.canonical_name;
    end if;
  end loop;
end;
$$;

-- Re-run the already-governed mapper so current provider fixtures immediately
-- benefit from the stricter deterministic alias normalization.
select scorecaster_private.refresh_event_identity_map();