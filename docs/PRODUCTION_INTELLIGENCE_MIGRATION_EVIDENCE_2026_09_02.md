# Scorecaster production intelligence migration evidence — 2026-09-02

Environment: production Supabase project rsukfxhgqzpofiszjtbf in eu-west-1.

This document retains migration-registry and aggregate catalog evidence only. It contains no secrets, tokens, model artifacts or application-row contents.

## Registered migrations

The production migration registry contains the exact migration names and versions below.

| Repository migration | Production version |
|---|---:|
| scorecaster_intelligence_core_v1.sql | 20260826030405 |
| scorecaster_event_identity_map_v1.sql | 20260826031557 |
| scorecaster_openfootball_bootstrap_v1.sql | 20260826031757 |
| scorecaster_event_identity_refresh_v1.sql | 20260826032056 |
| scorecaster_outcome_chronology_fix_v1.sql | 20260826032159 |
| scorecaster_own_model_scheduler_v1.sql | 20260826032407 |
| scorecaster_own_football_ml_v1.sql | 20260826040813 |
| scorecaster_own_decision_engine_v1.sql | 20260826042251 |
| scorecaster_owned_intelligence_triggers_v1.sql | 20260826042517 |
| scorecaster_model_registry_status_v2.sql | 20260826043042 |

## Self-data engine

scorecaster_self_data_engine_v1.sql predates the matching registry-name convention, so its production state was verified directly from PostgreSQL catalog metadata.

- Tables present: scorecaster_data_engine_runs_v1, scorecaster_pit_feature_snapshots_v1 and scorecaster_autonomous_decisions_v1.
- Valid indexes, including primary and unique indexes: 2, 5 and 6 respectively, matching the migration.
- RLS enabled and forced: 3/3 tables.
- Direct CRUD for anon: denied on 3/3 tables.
- Direct CRUD for authenticated: denied on 3/3 tables.
- CRUD for service_role: available on 3/3 tables.

No application rows were read or changed during this verification.
