# Scorecaster Public Schema Hardening V1

## Status

**Repository hardening can be prepared and tested without production access, but the issue is not production-complete until the SQL is applied and verified in the real Supabase project.**

A production Supabase privilege export on 2026-08-04 showed 23 public tables with Row Level Security disabled and full `anon` and `authenticated` grants. Those grants included `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES` and `UPDATE`. Several additional RLS-enabled internal relations had zero policies but still retained broad client grants.

This patch closes those reviewed direct browser surfaces while preserving Scorecaster's server-side API routes and protected workers through `service_role`.

## Files

- `scripts/apply-public-schema-hardening-v1.sql` — idempotent write patch
- `scripts/verify-public-schema-hardening-v1.sql` — read-only production verification
- `scripts/public-schema-hardening.test.mjs` — repository regression tests
- `scripts/public-schema-release-gate.mjs` — canonical release-audit repository gate
- `.github/workflows/public-schema-hardening.yml` — dedicated CI

`npm run release:audit` runs the normal Scorecaster release-readiness audit and then the public-schema repository gate. Passing that command means the reviewed hardening artifacts are present and internally consistent. It does **not** claim that production Supabase has already been changed.

## Access model after the patch

### Server-internal relations

The reviewed production-export groups become service-role-only:

- teams, matches and bookmaker reference data
- odds cache, market cache and odds snapshots
- model predictions, model outputs, ratings and rating update logs
- player and team statistics
- match context and context snapshots
- AI decisions, AI audit and AI intelligence storage
- analytics and feedback storage
- legacy bankroll entries and value-bet materialization

For ordinary/partitioned tables the patch:

1. enables RLS
2. forces RLS
3. revokes every privilege from `PUBLIC`, `anon` and `authenticated`
4. grants table access to `service_role`

Views and materialized views cannot use table RLS in the same way, so their browser grants are revoked and `service_role` retains reviewed read access.

The public application consumes these internal relations through server API routes. Broad browser grants must not be restored as a workaround.

### User-owned paper bets

`bets` keeps authenticated `SELECT`, `INSERT`, `UPDATE` and `DELETE`, but the migration now checks `pg_policies` first. All four operations must already have authenticated/public RLS-policy backing. If any required command is missing, the transaction raises and rolls back instead of restoring the grant.

### User settings

If the legacy production `user_settings` table exists, it keeps authenticated `SELECT`, `INSERT` and `UPDATE`; direct deletion remains revoked. The migration does not invent its schema or policies. All three retained commands must already have matching RLS-policy backing or the transaction fails closed.

### Community comments

`community_comments` keeps anonymous/authenticated read access and authenticated create/update/delete access. The migration verifies the existing policy matrix before restoring those grants. A missing public-read or authenticated-write policy aborts the hardening transaction.

## Fail-closed behavior

The migration is deliberately ordered as:

1. enter one transaction
2. enable/force RLS or revoke view grants on internal relations
3. revoke broad browser grants
4. inspect existing policies for the three reviewed client surfaces
5. restore only policy-backed grants
6. commit

A policy mismatch before step 6 rolls back the transaction. It must not leave a partially hardened database with a newly restored unsupported client grant.

The migration does not:

- create replacement policies for unknown production tables
- guess `user_settings` ownership columns
- drop tables or columns
- delete or truncate rows
- remove existing policies
- introduce bookmaker credentials or real-money functionality

## Read-only verification

`scripts/verify-public-schema-hardening-v1.sql` checks after apply that:

- reviewed tables have RLS and FORCE RLS
- views are protected by grant revocation
- `PUBLIC`, `anon` and `authenticated` retain no `TRUNCATE`, `TRIGGER` or `REFERENCES` privilege
- `PUBLIC` has no direct public-schema relation grants
- internal relations expose no anon/authenticated privileges
- `service_role` still has the required server access
- `bets`, `user_settings` and `community_comments` match their reviewed grant matrices
- every retained reviewed client command has RLS-policy backing

A successful verification returns version `public-schema-hardening-v1.2` with `reviewedClientGrantsPolicyBacked: true` and `paperOnly: true`.

## Apply in production Supabase

Do this only when production database access is available:

1. Confirm the normal Scorecaster production migrations have already been applied.
2. Open the production Supabase project and SQL Editor.
3. Paste the complete current contents of `scripts/apply-public-schema-hardening-v1.sql`.
4. Review that it contains no destructive row/table operation.
5. Run it once.
6. Run `scripts/verify-public-schema-hardening-v1.sql` as a separate read-only query.
7. Save the final verification JSON as production evidence.
8. Run the smoke checks below.

The apply script is idempotent. Running it again reapplies the same reviewed matrix, subject to the same policy checks.

## Required smoke checks after apply

- `/api/value-bets` returns normally through the server route
- feedback submission works through `/api/feedback`
- analytics tracking works through `/api/track`
- Top Picks and event pages still load
- authenticated paper history can read/write only the current user's permitted rows
- Community Feed comments remain publicly readable
- anonymous clients cannot read or write reviewed internal relations
- server workers continue operating through `service_role`

## Release-readiness boundary

The repository gate is now part of `npm run release:audit`. It verifies that the hardening SQL, read-only verifier, regression coverage, documentation and CI contract are present and fail closed.

The gate intentionally prints an external blocker until production work is performed:

> apply the hardening SQL in production Supabase, run the read-only verification SQL and retain its JSON result before production activation.

This keeps repository readiness separate from production evidence. CI success must never be reported as proof that the production database was changed.

## Rollback policy

There is no automatic rollback to the insecure grant state. If a server endpoint fails after apply, first verify that it uses the intended authenticated RLS path or server-only `service_role` path. Correct the route or add one narrowly reviewed policy-backed permission; do not restore broad `anon` / `authenticated` access.

## Product boundary

The patch changes database authorization only. Scorecaster remains sports analysis, risk control and virtual paper tracking. It adds no bookmaker login, deposits, withdrawals, payment data, Cash Out or automatic real-money execution.
