-- Scorecaster Supabase storage audit (read-only).
-- Run before any retention, deduplication or index changes.
-- pg_stat estimates are approximate; do not delete historical odds or model evidence blindly.
SELECT schemaname, relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       pg_size_pretty(pg_relation_size(relid)) AS heap_size,
       pg_size_pretty(pg_indexes_size(relid)) AS indexes_size,
       n_live_tup AS estimated_rows,
       n_dead_tup AS estimated_dead_rows,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC;

-- Find the largest indexes before proposing any index removal.
SELECT schemaname, relname AS table_name, indexrelname AS index_name,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
       idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 40;
-- idx_scan=0 is NOT permission to remove an index:
-- statistics reset, writes, unique constraints and FK dependencies matter.

-- Verify actual physical database size separately from table totals.
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

-- Safety requirements before implementing retention:
-- 1. Inventory downstream consumers and event/market time-series dependencies.
-- 2. Define retention windows separately for raw snapshots and canonical history.
-- 3. Prove restore from a tested backup/export before destructive cleanup.
-- 4. Batch deletion and measure reclaimed bytes; DELETE alone may not reduce disk usage.
-- 5. Never remove odds movement, bet tracking or model-training evidence without approval.


-- Non-destructive capture growth assessment. Keep original odds rows and
-- final closing-line evidence until an export/restore test is documented.
SELECT 'market_provider_snapshots_v2' AS source,
       date_trunc('week', captured_at)::date AS capture_week,
       count(*) AS rows
FROM public.market_provider_snapshots_v2
GROUP BY 1, 2
UNION ALL
SELECT 'sports_analytics_observations',
       date_trunc('week', captured_at)::date,
       count(*)
FROM public.sports_analytics_observations
GROUP BY 1, 2
ORDER BY source, capture_week;

-- Check how much space belongs to large indexes vs. actual table data,
-- so a plan can be based on physical bytes, not estimated row counts.
SELECT relname AS table_name,
       pg_total_relation_size(relid) AS total_bytes,
       pg_relation_size(relid) AS heap_bytes,
       pg_indexes_size(relid) AS indexes_bytes,
       n_live_tup AS estimated_rows,
       n_dead_tup AS estimated_dead_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 25;
