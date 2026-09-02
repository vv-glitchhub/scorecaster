-- Scorecaster pg_net extension schema V1
--
-- pg_net 0.20 is non-relocatable after installation, so correcting the
-- extension namespace requires an atomic drop/create. Refuse the operation if
-- any outbound request is pending. net._http_response is an ephemeral response
-- cache and is intentionally rebuilt with the extension.

begin;

do $preflight$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net extension is missing';
  end if;
  if (select count(*) from net.http_request_queue) <> 0 then
    raise exception 'pg_net schema move refused: outbound requests are pending';
  end if;
end;
$preflight$;

create schema if not exists extensions;
drop extension pg_net;
create extension pg_net with schema extensions;

do $verify$
declare
  extension_schema text;
begin
  select n.nspname into extension_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_net';

  if extension_schema is distinct from 'extensions' then
    raise exception 'pg_net extension schema mismatch: %', extension_schema;
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'pg_net installation is missing net.http_post';
  end if;
end;
$verify$;

commit;
