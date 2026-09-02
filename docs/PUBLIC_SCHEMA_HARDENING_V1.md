# Scorecaster Public Schema Hardening V1.5

## Status

**V1.5 is verified against production Supabase on 2026-09-02. Repository CI remains separate from production proof: matching SQL, catalog checks, authenticated rollback-smokes and fresh Security Advisor results are all retained.**

The production audit found that all 80 public tables already had RLS + FORCE RLS, but legacy grants were still broader than the current product contract. In particular:

- browser roles retained `TRUNCATE`, `TRIGGER` and `REFERENCES` on many tables;
- `profiles` still allowed authenticated INSERT/DELETE and retained the obsolete `Users insert own profile` policy;
- anonymous roles retained broad grants on old authenticated user-owned MVP tables;
- several policyless server-internal RLS tables still retained browser grants;
- many public `SECURITY DEFINER` functions were executable through inherited PUBLIC/browser privileges even though their intended callers are protected workers or database triggers.

V1.5 narrows those surfaces without deleting application tables, columns or rows and without changing Scorecaster's paper-only product boundary.

## Files

- `scripts/apply-public-schema-hardening-v1.sql` — idempotent V1.5 write patch
- `scripts/verify-public-schema-hardening-v1.sql` — read-only V1.5 production verification
- `supabase/scorecaster_authenticated_rpc_boundaries_v1.sql` — public invoker/private definer RPC split
- `supabase/scorecaster_pg_net_extension_schema_v1.sql` — atomic pg_net namespace repair
- `scripts/public-schema-hardening.test.mjs` — repository regression tests
- `scripts/public-schema-release-gate.mjs` — canonical release-audit gate
- `.github/workflows/public-schema-hardening.yml` — dedicated CI

`npm run release:audit` verifies repository consistency only. Production evidence remains a separate gate.

## V1.5 access model

### Global browser privilege floor

For ordinary/partitioned public tables, browser roles never retain database-owner style privileges:

- `TRUNCATE`
- `TRIGGER`
- `REFERENCES`

`PUBLIC` receives no direct public-schema table/view grants.

Any RLS-enabled table with zero policies is treated as server-internal: all `PUBLIC`/`anon`/`authenticated` grants are revoked and `service_role` access is retained.

### Reviewed server-internal relations

The existing reviewed internal list remains browser-closed and service-role-owned. Tables are RLS + FORCE RLS; views/materialized views are protected by grant revocation.

### Profiles

Profile creation is database/server-owned through the `auth.users` trigger. V1.5:

- drops the obsolete `Users insert own profile` policy;
- revokes all profile privileges from `PUBLIC`, `anon` and `authenticated`;
- restores only authenticated `SELECT` + `UPDATE` after policy checks;
- retains service-role access.

Direct profile INSERT/DELETE remains forbidden to clients.

### Legacy authenticated user-owned MVP rows

These existing RLS tables remain authenticated CRUD surfaces:

- `bet_slips`
- `bet_slip_items`
- `tracked_bets`
- `pick_explanations`
- `agent_feedback`
- `risk_events`

Anon access is removed. Authenticated `SELECT`/`INSERT`/`UPDATE`/`DELETE` is restored only if the existing RLS policy supports the command. `TRUNCATE`/`TRIGGER`/`REFERENCES` are never restored.

### Current client matrices

- `bets`: authenticated CRUD; anon closed
- `user_settings`: authenticated SELECT/INSERT/UPDATE; DELETE closed
- `community_comments`: anon/authenticated SELECT; authenticated INSERT/UPDATE/DELETE

Existing RLS policies remain the row-ownership boundary.

## SECURITY DEFINER execution lockdown

Every current public `SECURITY DEFINER` function is enumerated during apply. V1.5:

1. revokes inherited/direct EXECUTE from `PUBLIC`, `anon` and `authenticated`;
2. grants EXECUTE to `service_role`;
3. permits no authenticated EXECUTE on a public `SECURITY DEFINER` function;
4. keeps four authenticated public RPCs as `SECURITY INVOKER` wrappers whose constrained privileged implementations live in `scorecaster_private`:
   - `claim_notification_device(text,text,text,text)`
   - `request_autonomous_agent_run()`
   - `set_auto_watch_recommendation_preferences(boolean,integer,numeric,integer)`
   - `set_auto_watch_recommendation_preferences_v2(boolean,integer,numeric,integer,text,numeric,numeric,numeric,text[])`

Anon receives no `SECURITY DEFINER` EXECUTE permission.

Trigger functions such as profile creation, notification-state synchronization and worker scheduling do not need browser EXECUTE grants to fire from their installed triggers. Worker claim/complete functions remain service-role-only.

## Fail-closed behavior

The entire hardening patch runs in one transaction. Before a reviewed client grant is restored, the migration verifies matching RLS policy support in `pg_policies`. Missing support raises `Public schema hardening refused:` and rolls the whole transaction back.

The migration does **not**:

- drop tables or columns;
- delete or truncate rows;
- invent ownership policies for unknown tables;
- weaken RLS/FORCE RLS;
- grant browser `TRUNCATE`, `TRIGGER` or `REFERENCES`;
- grant anon access to SECURITY DEFINER functions;
- add bookmaker credentials or real-money execution.

## Read-only production verification

`scripts/verify-public-schema-hardening-v1.sql` requires:

- RLS + FORCE RLS on every public ordinary/partitioned table;
- zero browser `TRUNCATE`/`TRIGGER`/`REFERENCES` grants;
- zero direct `PUBLIC` relation grants;
- zero browser grants on policyless RLS tables;
- zero browser exposure on the reviewed internal relation list;
- service-role access preserved;
- profiles exactly authenticated SELECT+UPDATE with no legacy INSERT policy;
- legacy user-owned MVP tables exactly authenticated CRUD and anon-closed;
- current bets/user-settings/community matrices intact;
- zero anon SECURITY DEFINER EXECUTE;
- zero authenticated EXECUTE on public SECURITY DEFINER functions;
- all four authenticated public wrappers are SECURITY INVOKER and anon-closed;
- service-role EXECUTE on every current public SECURITY DEFINER function.

A passing query returns `public-schema-hardening-v1.5`, `reviewedClientGrantsPolicyBacked: true`, `securityDefinerAuthenticatedExecute: 0` and `paperOnly: true`.

## Production Supabase apply sequence

1. Run repository CI/release audit against the exact V1.5 SQL.
2. Apply the exact current `scripts/apply-public-schema-hardening-v1.sql` through the production Supabase migration path.
3. Run `scripts/verify-public-schema-hardening-v1.sql` read-only.
4. Retain the returned JSON as non-secret production evidence.
5. Rerun Supabase Security Advisor and compare remaining warnings.
6. Smoke authenticated cloud APIs, public Community Feed reads and protected workers.
7. Only then update/close #99.

The script is idempotent; a second run reapplies the same reviewed authorization surface.

## Required smoke checks

- `/api/value-bets`, `/api/feedback`, `/api/track` continue using server-side access;
- authenticated paper/cloud history remains user-scoped;
- notification device registration still works through `claim_notification_device`;
- authenticated API rate limiting still works through `consume_api_quota`;
- autonomous paper-agent manual run request still works through `request_autonomous_agent_run`;
- Community Feed remains publicly readable but anon cannot mutate it;
- protected workers continue operating through service-role/server paths;
- browser roles cannot directly reach policyless/internal relations.

## Separate Auth warning

Supabase Security Advisor reports only leaked-password protection disabled for Auth after V1.5. The organization is on the Free plan and Supabase documents that feature as Pro-only, so this SQL patch must not claim it is fixed or purchase a plan without owner approval.

## Product boundary

The patch changes database authorization only. Scorecaster remains sports analysis, risk control and virtual paper tracking. It adds no bookmaker login, deposits, withdrawals, payment data, Cash Out or automatic real-money execution.
