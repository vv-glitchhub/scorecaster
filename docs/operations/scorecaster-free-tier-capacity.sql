-- Scorecaster Free hot/cold audit. STRICTLY read-only, non-destructive.
-- Approximate row estimates MUST NOT be interpreted as reclaimable bytes.
-- Actual physical database size, indexes, TOAST, and extension storage matter.
SELECT pg_database_size(current_database()) AS current_database_bytes,
       pg_size_pretty(pg_database_size(current_database())) AS physical_size,
       500 * 1024 * 1024 AS illustrative_free_database_bytes,
       400 * 1024 * 1024 AS target_hot_database_bytes,
       GREATEST(0, pg_database_size(current_database()) - 400 * 1024 * 1024) AS bytes_over_hot_target;

-- Entire public database inventory; do not delete any table from this list.
SELECT relname AS table_name,
       pg_total_relation_size(relid) AS physical_bytes,
       pg_relation_size(relid) AS heap_bytes,
       pg_indexes_size(relid) AS index_bytes,
       n_live_tup AS approximate_rows,
       n_dead_tup AS approximate_dead_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY physical_bytes DESC;

-- Read-only sample counts for candidate ARCHIVE windows only. A row is not
-- safe to delete just because it is old. Recoverable historical predictions,
-- betting audit/settlement, event outcomes and near-kickoff price history may
-- depend on older rows.
SELECT 'market_provider_snapshots_v2' AS source,
       count(*) AS total,
       count(*) FILTER (WHERE captured_at < now() - interval '3 days') AS older_than_3_days,
       count(*) FILTER (WHERE captured_at < now() - interval '7 days') AS older_than_7_days,
       min(captured_at) AS earliest,
       max(captured_at) AS latest
FROM public.market_provider_snapshots_v2
UNION ALL
SELECT 'sports_analytics_observations',
       count(*),
       count(*) FILTER (WHERE captured_at < now() - interval '3 days'),
       count(*) FILTER (WHERE captured_at < now() - interval '7 days'),
       min(captured_at),
       max(captured_at)
FROM public.sports_analytics_observations
UNION ALL
SELECT 'unified_data_snapshots',
       count(*),
       count(*) FILTER (WHERE captured_at < now() - interval '3 days'),
       count(*) FILTER (WHERE captured_at < now() - interval '7 days'),
       min(captured_at),
       max(captured_at)
FROM public.unified_data_snapshots
ORDER BY source;

-- Model records need a separate reproducible retention/restore decision,
-- not the three-day raw odds window.
SELECT 'scorecaster_own_decisions_v1' AS source,
       count(*) AS total,
       min(as_of) AS earliest,
       max(as_of) AS latest
FROM public.scorecaster_own_decisions_v1
UNION ALL
SELECT 'scorecaster_model_predictions_v1',
       count(*),
       min(as_of),
       max(as_of)
FROM public.scorecaster_model_predictions_v1;

-- References must be reviewed before a table is archived or altered.
-- Includes cascading deletes and dependencies between hot and cold data.
SELECT conrelid::regclass AS child_table,
       confrelid::regclass AS referenced_table,
       conname AS constraint_name,
       pg_get_constraintdef(oid) AS constraint_rule
FROM pg_constraint
WHERE contype = 'f'
  AND (conrelid IN (
    'public.market_provider_snapshots_v2'::regclass,
    'public.sports_analytics_observations'::regclass,
    'public.unified_data_snapshots'::regclass,
    'public.sports_analytics_snapshots'::regclass
  ) OR confrelid IN (
    'public.market_provider_snapshots_v2'::regclass,
    'public.sports_analytics_observations'::regclass,
    'public.unified_data_snapshots'::regclass,
    'public.sports_analytics_snapshots'::regclass
  ))
ORDER BY child_table, referenced_table;

-- Beware: idx_scan=0 does not imply an index can safely be dropped.
SELECT relname AS table_name, indexrelname AS index_name,
       pg_relation_size(indexrelid) AS index_bytes,
       idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY index_bytes DESC
LIMIT 25;
