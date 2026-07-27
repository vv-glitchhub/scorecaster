\set ON_ERROR_STOP on

begin;

select to_regclass('public.collector_runs') is not null as collector_runs_exists \gset
\if :collector_runs_exists
\else
  \quit 1
\endif

select to_regclass('public.collector_records') is not null as collector_records_exists \gset
\if :collector_records_exists
\else
  \quit 1
\endif

do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'collector_runs' and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'collector_runs RLS is not forced'; end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'collector_records' and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'collector_records RLS is not forced'; end if;
  if has_table_privilege('anon', 'public.collector_records', 'select') then
    raise exception 'anon must not read collector_records directly';
  end if;
  if has_table_privilege('authenticated', 'public.collector_records', 'select') then
    raise exception 'authenticated must not read collector_records directly';
  end if;
end $$;

rollback;
