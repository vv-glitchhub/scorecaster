create or replace function scorecaster_private.normalize_team_identity(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(
      extensions.unaccent(lower(coalesce(value,''))),
      '\m(fc|afc|cf|sc|ac|fk|bk|if|aif|ud|cd|rc|rcd|ssc|club|football|calcio|futbol|fútbol)\M', '', 'g'
    ),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

revoke all on function scorecaster_private.normalize_team_identity(text) from public, anon, authenticated;

-- Re-run the existing mapper immediately so live provider event IDs benefit from
-- the broader club-name normalization without waiting for the scheduled refresh.
select scorecaster_private.refresh_event_identity_map();
