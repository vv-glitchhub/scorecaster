# Scorecaster Public Schema Hardening V1

## Why this patch exists

A production Supabase privilege export on 2026-08-04 showed 23 public tables with Row Level Security disabled and full `anon` and `authenticated` grants. Those grants included `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES` and `UPDATE`. Several additional RLS-enabled internal tables had zero policies but still retained broad client grants.

This patch closes those direct browser surfaces while preserving Scorecaster's server-side API routes and protected workers through `service_role`.

## Files

- `scripts/apply-public-schema-hardening-v1.sql` — idempotent write patch
- `scripts/verify-public-schema-hardening-v1.sql` — read-only verification
- `scripts/public-schema-hardening.test.mjs` — repository regression tests

## Access model after the patch

### Server-internal tables

The following groups become service-role-only:

- teams, matches and bookmaker reference data
- odds cache, market cache and odds snapshots
- model predictions, model outputs, ratings and rating update logs
- player and team statistics
- match context and context snapshots
- AI decisions, AI audit and AI intelligence storage
- analytics and feedback storage
- legacy bankroll entries and value-bet materialization

For these tables the patch:

1. enables RLS
2. forces RLS
3. revokes every privilege from `PUBLIC`, `anon` and `authenticated`
4. grants full table access to `service_role`

The public application continues to consume these tables through server API routes. It does not need direct browser-to-table access.

### User-owned tables

`bets` keeps authenticated `SELECT`, `INSERT`, `UPDATE` and `DELETE`. Existing RLS policies still decide which user-owned rows are visible or writable.

`user_settings` keeps authenticated `SELECT`, `INSERT` and `UPDATE`. Direct deletion is removed.

### Community comments

`community_comments` keeps public read access and authenticated create/update/delete access. The existing four owner-aware RLS policies remain unchanged.

## Apply in Supabase

1. Open the production Supabase project.
2. Open **SQL Editor**.
3. Create a new query.
4. Paste the complete contents of `scripts/apply-public-schema-hardening-v1.sql`.
5. Review the script. It must contain no `DROP TABLE`, row deletion or table truncation.
6. Run it once.
7. Create another query and run `scripts/verify-public-schema-hardening-v1.sql`.
8. Save the final JSON result as production evidence.

The apply script is idempotent. Running it again reapplies the same grant matrix and RLS settings.

## Required smoke checks after apply

- `/api/value-bets` returns normally through the server route
- feedback submission works through `/api/feedback`
- analytics tracking works through `/api/track`
- Top Picks and event pages still load
- authenticated paper history can read and write only the current user's rows
- Community Feed comments remain publicly readable
- an anonymous Supabase client cannot read or write internal tables

## Failure behavior

The patch intentionally fails closed. If a server endpoint stops working after apply, first confirm that `SUPABASE_SERVICE_ROLE_KEY` is configured only on the server. Do not restore broad `anon` or `authenticated` grants as a workaround.

## Rollback policy

There is no automatic rollback to the insecure grant state. A failure must be corrected by fixing the affected server route or by adding a narrowly reviewed, policy-backed grant for one specific table and operation.

## Product boundary

The patch does not add bookmaker credentials, deposits, withdrawals, payment data or automatic real-money execution. Scorecaster remains a sports-analysis and virtual paper-tracking product.
