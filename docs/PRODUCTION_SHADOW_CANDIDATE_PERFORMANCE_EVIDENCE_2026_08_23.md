# Production Shadow Candidate Performance Evidence — 2026-08-23

## Applied change

`supabase/scorecaster_shadow_candidate_settlement_performance_v2.sql` was applied to production project `rsukfxhgqzpofiszjtbf`.

The migration creates one non-unique partial B-tree index:

`idx_autonomous_audit_open_settlement_candidates_v2`

It contains only open rows with a non-null event ID and model probability, matching the protected settlement worker's candidate boundary.

## Read-only verification

- index catalog state: valid and ready
- production candidate count at verification: 1,325
- `EXPLAIN (FORMAT JSON)` selected an `Index Scan` using the new index
- scan order matches `created_at asc`
- the worker remains service-role-only, paper-only and bounded to 1,000 candidates
- no application row was changed by the migration or verification

The application-side worker sends settlement updates in batches of 100 so a single PostgREST RPC statement no longer approaches the production statement timeout.
