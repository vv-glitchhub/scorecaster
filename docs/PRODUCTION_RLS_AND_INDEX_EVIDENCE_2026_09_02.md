# Production RLS and index evidence — 2026-09-02

This record contains no credentials, raw user identifiers, or application user data. The checks targeted the Scorecaster production Supabase project and were performed through the configured Supabase connection.

## Representative two-user RLS rollback probe

At `2026-09-02T16:36:00Z`, two temporary test identities and isolated fixtures were created inside one database transaction. The transaction switched to the `authenticated` role and set each test identity through the request JWT subject claim.

The probe covered these representative user-owned tables:

- `public.bets`
- `public.watchlist_items`
- `public.autonomous_agent_settings`

For both identities, own-row `SELECT` returned exactly one row and cross-user visibility returned zero rows. Cross-user `UPDATE` attempts against `bets` and `autonomous_agent_settings` returned zero rows. The transaction was rolled back, and a separate follow-up query confirmed that zero temporary users, bets, and watchlist rows remained.

This is real production-database evidence for the core RLS ownership boundary. It does not replace the repository's complete 12-table transactional probe or the two-account bearer/cookie, export, deletion, native-app, and physical-device tests. Those gates remain explicit until dedicated disposable production test accounts and devices are available.

## Foreign-key index hardening

The additive migration `scorecaster_fk_index_hardening_v1` was applied to production. It created, if missing:

- `scorecaster_learning_examples_v1_outcome_id_idx`
- `scorecaster_model_predictions_v1_feature_snapshot_id_idx`

Both indexes were verified in `pg_indexes`. A fresh performance-advisor run reported zero unindexed foreign keys owned by Scorecaster. The remaining unindexed-FK findings belong to the separate Stockcaster schema surface and were not changed by this release.

## Autonomous audit write performance

Production statement statistics identified `autonomous_agent_decision_audit` inserts as the user-processing timeout hotspot: the shadow-default trigger had to look up `commence_time` for each audit row. The worker now supplies the already-verified event `commenceTime` directly. A fallback index, `market_provider_snapshots_v2_event_commence_idx`, supports the trigger lookup when an older or incomplete candidate does not contain that value. A production `EXPLAIN (ANALYZE, BUFFERS)` confirmed an index-only scan and a representative execution below 4 ms. This keeps the safety trigger intact while removing repeated database work from the normal path.

## Remaining Supabase advisor boundary

The security advisor still reports one warning: leaked-password protection is disabled. Enabling that protection requires a Supabase plan feature and is therefore an external account decision, not a repository change. The remaining RLS-with-no-policy notices are informational and concern intentionally server-only, fail-closed tables; they must remain unavailable to browser clients.

## Safety

- No destructive DDL or application-row deletion was used in this hardening migration.
- All temporary RLS test data was contained in a transaction and rolled back.
- Follow-up residue checks returned zero temporary rows.
- No credentials, tokens, email addresses, or raw user identifiers are included in this evidence.
