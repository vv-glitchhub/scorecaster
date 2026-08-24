-- Scorecaster Enterprise API V1
-- Reviewed production patch: tenant registry, hashed API keys and per-tenant minute quota.
-- Raw API keys are never stored. Browser roles receive no direct table access.

create table if not exists public.scorecaster_enterprise_api_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active',
  allowed_scopes text[] not null default array['recommendations:read','leagues:read']::text[],
  rate_limit_per_minute integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scorecaster_enterprise_tenant_slug check (slug ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  constraint scorecaster_enterprise_tenant_status check (status in ('active','suspended','closed')),
  constraint scorecaster_enterprise_tenant_rate check (rate_limit_per_minute between 1 and 600),
  constraint scorecaster_enterprise_tenant_scope_count check (cardinality(allowed_scopes) between 1 and 20)
);

create table if not exists public.scorecaster_enterprise_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.scorecaster_enterprise_api_tenants(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null unique,
  label text not null default 'default',
  scopes text[] not null default array['recommendations:read','leagues:read']::text[],
  active boolean not null default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint scorecaster_enterprise_key_prefix check (key_prefix ~ '^sc_(live|test)_[A-Za-z0-9_-]{4,24}$'),
  constraint scorecaster_enterprise_key_hash check (key_hash ~ '^[a-f0-9]{64}$'),
  constraint scorecaster_enterprise_key_scope_count check (cardinality(scopes) between 1 and 20),
  constraint scorecaster_enterprise_key_label_length check (char_length(label) between 1 and 120)
);

create index if not exists idx_scorecaster_enterprise_api_keys_tenant
  on public.scorecaster_enterprise_api_keys(tenant_id, active);
create index if not exists idx_scorecaster_enterprise_api_keys_prefix
  on public.scorecaster_enterprise_api_keys(key_prefix);

create table if not exists public.scorecaster_enterprise_api_usage_minute (
  tenant_id uuid not null references public.scorecaster_enterprise_api_tenants(id) on delete cascade,
  bucket_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, bucket_start),
  constraint scorecaster_enterprise_usage_nonnegative check (request_count >= 0)
);

create index if not exists idx_scorecaster_enterprise_usage_recent
  on public.scorecaster_enterprise_api_usage_minute(bucket_start desc);

create or replace function public.consume_scorecaster_enterprise_api_quota(
  p_tenant_id uuid,
  p_limit integer
)
returns table(allowed boolean, request_count integer, limit_per_minute integer, bucket_start timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket timestamptz := date_trunc('minute', now());
  v_count integer;
  v_limit integer := greatest(1, least(coalesce(p_limit, 1), 600));
begin
  if p_tenant_id is null then
    raise exception 'tenant required';
  end if;

  insert into public.scorecaster_enterprise_api_usage_minute as usage (
    tenant_id, bucket_start, request_count, updated_at
  ) values (p_tenant_id, v_bucket, 1, now())
  on conflict (tenant_id, bucket_start) do update
  set request_count = usage.request_count + 1,
      updated_at = now()
  returning scorecaster_enterprise_api_usage_minute.request_count into v_count;

  return query select v_count <= v_limit, v_count, v_limit, v_bucket;
end;
$$;

alter table public.scorecaster_enterprise_api_tenants enable row level security;
alter table public.scorecaster_enterprise_api_tenants force row level security;
alter table public.scorecaster_enterprise_api_keys enable row level security;
alter table public.scorecaster_enterprise_api_keys force row level security;
alter table public.scorecaster_enterprise_api_usage_minute enable row level security;
alter table public.scorecaster_enterprise_api_usage_minute force row level security;

revoke all on public.scorecaster_enterprise_api_tenants from anon, authenticated;
revoke all on public.scorecaster_enterprise_api_keys from anon, authenticated;
revoke all on public.scorecaster_enterprise_api_usage_minute from anon, authenticated;

revoke execute on function public.consume_scorecaster_enterprise_api_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_scorecaster_enterprise_api_quota(uuid, integer) to service_role;

comment on table public.scorecaster_enterprise_api_keys is 'Hashed Enterprise API credentials only. Raw keys must never be persisted.';
comment on table public.scorecaster_enterprise_api_tenants is 'Server-owned Scorecaster Enterprise API tenant registry.';
comment on function public.consume_scorecaster_enterprise_api_quota(uuid, integer) is 'Service-role-only atomic per-tenant minute quota.';
