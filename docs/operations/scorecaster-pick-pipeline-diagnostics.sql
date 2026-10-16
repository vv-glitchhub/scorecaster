-- Scorecaster pick-pipeline diagnostics; READ ONLY. No deletions or index changes.
-- Use alongside the application Top Picks endpoint and worker logs.
-- An existing row does not prove the UI reads it.
SELECT relname, n_live_tup AS estimated_rows, pg_size_pretty(pg_total_relation_size(relid)) AS bytes
FROM pg_stat_user_tables
WHERE schemaname='public' AND relname IN
('market_provider_snapshots_v2','sports_analytics_observations',
'scorecaster_own_decisions_v1','scorecaster_model_predictions_v1',
'scorecaster_event_outcomes_v1','unified_data_snapshots')
ORDER BY pg_total_relation_size(relid) DESC;

-- Provider freshness, by league. An old latest capture cannot support a live recommendation.
SELECT league, COUNT(*) AS stored_rows, COUNT(DISTINCT event_id) AS events,
MAX(captured_at) AS latest_capture,
COUNT(*) FILTER (WHERE captured_at >= now()-interval '1 hour') AS rows_last_hour
FROM public.market_provider_snapshots_v2
GROUP BY league ORDER BY stored_rows DESC;

-- Verify whether model/decision records are fresh; do not interpret counts as playable picks.
SELECT 'decisions' AS source, count(*) AS rows, max(created_at) AS latest_created
FROM public.scorecaster_own_decisions_v1
UNION ALL SELECT 'predictions', count(*), max(created_at)
FROM public.scorecaster_model_predictions_v1
UNION ALL SELECT 'outcomes', count(*), max(created_at)
FROM public.scorecaster_event_outcomes_v1;

-- Next verification: inspect actual producer and consumer code for every table,
-- trace Top Picks rejection reasons and provider timestamps end-to-end,
-- validate backups and dependencies before changing retention or deleting rows.
-- Never make stale snapshots appear current; never bypass risk gates to produce picks.
